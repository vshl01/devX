/**
 * Grounded multilingual prescription Q&A.
 *
 * Flow:
 *  1. Load canonical structuredData from Prisma (source of truth)
 *  2. Detect user language
 *  3. Resolve intent (multilingual keywords → optional Sarvam chat classifier)
 *  4. Deterministically retrieve facts from the prescription
 *  5. Build a grounded English answer (templates only — no free medical advice)
 *  6. Translate answer into the user's language via Sarvam Translate
 *  7. Optional Bulbul TTS
 *
 * Never invents vitals, medicines, dosages, or diagnoses.
 */

import { AppError, ErrorCodes } from '../utils/errors.js';
import { createEmptyCanonicalPrescription } from './prescription.mapper.js';
import { translateText } from '../sarvam/translate.js';
import { chatCompletion, parseJsonFromModel } from '../sarvam/chat.js';
import { synthesizeSpeech } from '../sarvam/tts.js';
import {
  isSupportedLanguage,
  normalizeLanguageCode,
  PRIMARY_TARGET_LANGUAGES,
} from '../sarvam/languages.js';

const NOT_FOUND_SUFFIX =
  'Please contact your doctor for clarification.';

const OUT_OF_SCOPE_EN =
  "That information isn't provided in your prescription. Please contact your doctor for medical guidance.";

const INTENTS = Object.freeze([
  'bloodPressure',
  'bloodSugar',
  'temperature',
  'pulse',
  'weight',
  'spo2',
  'patient',
  'doctor',
  'date',
  'medications',
  'medicationDetail',
  'tests',
  'followUp',
  'diagnosis',
  'instructions',
  'vitalsOverview',
  'outOfScope',
  'unknown',
]);

/**
 * @param {string} prescriptionId
 * @param {string} question
 * @param {{
 *   history?: Array<{ role: string, text: string }>,
 *   language?: string | null,
 *   includeAudio?: boolean,
 * }} [options]
 */
export async function answerPrescriptionQuestion(prescriptionId, question, options = {}) {
  const trimmed = typeof question === 'string' ? question.trim() : '';
  if (!trimmed) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'question is required.', 400);
  }
  if (trimmed.length > 1000) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'question is too long.', 400);
  }

  const { prisma } = await import('../prisma.js');
  const row = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    select: {
      id: true,
      status: true,
      structuredData: true,
      originalLanguage: true,
    },
  });

  if (!row) {
    throw new AppError(ErrorCodes.PRESCRIPTION_NOT_FOUND, 'Prescription not found.', 404);
  }

  if (!row.structuredData) {
    throw new AppError(
      ErrorCodes.PRESCRIPTION_NOT_READY,
      'Prescription has not been extracted yet.',
      409,
    );
  }

  const prescription = normalizePrescription(row.structuredData);
  const history = normalizeHistory(options.history);
  const responseLanguage = resolveResponseLanguage(trimmed, options.language);

  const grounded = await answerGrounded({
    prescription,
    question: trimmed,
    history,
    responseLanguage,
  });

  let audio = null;
  if (options.includeAudio && grounded.answer) {
    try {
      const speech = await synthesizeSpeech({
        text: grounded.answer,
        targetLanguageCode: responseLanguage,
      });
      audio = {
        mimeType: speech.mimeType,
        base64: speech.audioBase64,
      };
    } catch {
      // Voice is optional — never fail the text answer because TTS failed.
      audio = null;
    }
  }

  return {
    answer: grounded.answer,
    found: grounded.found,
    grounded: grounded.found,
    reason: grounded.found ? null : grounded.reason,
    language: responseLanguage,
    source: grounded.source,
    audio,
  };
}

/**
 * Pure grounded answering used by unit tests (English templates, no network).
 *
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 * @param {string} question
 */
export function answerFromPrescription(prescription, question) {
  const intent = detectIntentsMultilingual(question)[0] || 'unknown';
  return buildAnswerForIntent(prescription, intent, question, []);
}

/**
 * @param {{
 *   prescription: ReturnType<typeof createEmptyCanonicalPrescription>,
 *   question: string,
 *   history: Array<{ role: string, text: string }>,
 *   responseLanguage: string,
 * }} input
 */
async function answerGrounded(input) {
  const { prescription, question, history, responseLanguage } = input;

  let intents = detectIntentsMultilingual(question);
  let medicineHint = null;

  // Follow-ups like "when should I take it?" need history + classifier.
  const needsClassifier =
    intents.length === 0
    || intents[0] === 'unknown'
    || history.length > 0
    || isAmbiguousReference(question);

  if (needsClassifier) {
    try {
      const classified = await classifyIntentWithSarvam(question, history, prescription);
      if (classified?.intent && INTENTS.includes(classified.intent)) {
        intents = [classified.intent];
      }
      if (classified?.medicineName) medicineHint = classified.medicineName;
      if (classified?.outOfScope) intents = ['outOfScope'];
    } catch {
      // Fall back to keyword intents / unknown.
    }
  }

  if (intents.length === 0) intents = ['unknown'];

  let result = null;
  for (const intent of intents) {
    result = buildAnswerForIntent(prescription, intent, question, history, medicineHint);
    if (result) break;
  }
  if (!result) {
    result = notFound(null, 'I could not find that detail in your prescription.');
  }

  const answer = await localizeAnswer(result.answer, responseLanguage);
  return { ...result, answer };
}

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 * @param {string} intent
 * @param {string} question
 * @param {Array<{ role: string, text: string }>} history
 * @param {string | null} [medicineHint]
 */
function buildAnswerForIntent(prescription, intent, question, history = [], medicineHint = null) {
  const q = question.toLowerCase();
  const vitals = prescription.vitals || {};

  switch (intent) {
    case 'outOfScope':
      return {
        answer: OUT_OF_SCOPE_EN,
        found: false,
        reason: 'OUT_OF_SCOPE',
        source: null,
      };
    case 'bloodPressure':
      return vitalAnswer(
        'vitals.bloodPressure',
        vitals.bloodPressure,
        'blood pressure',
        (v) => `Your prescription records your blood pressure as ${v}.`,
      );
    case 'bloodSugar':
      return vitalAnswer(
        'vitals.bloodSugar',
        vitals.bloodSugar,
        'blood sugar',
        (v) => `Your prescription records your blood sugar as ${v}.`,
      );
    case 'temperature':
      return vitalAnswer(
        'vitals.temperature',
        vitals.temperature,
        'temperature',
        (v) => `Your prescription records your temperature as ${v}.`,
      );
    case 'pulse':
      return vitalAnswer(
        'vitals.pulse',
        vitals.pulse,
        'pulse',
        (v) => `Your prescription records your pulse as ${v}.`,
      );
    case 'weight':
      return vitalAnswer(
        'vitals.weight',
        vitals.weight,
        'weight',
        (v) => `Your prescription records your weight as ${v}.`,
      );
    case 'spo2':
      return vitalAnswer(
        'vitals.spo2',
        vitals.spo2,
        'SpO2',
        (v) => `Your prescription records your SpO2 as ${v}.`,
      );
    case 'patient':
      return answerPatient(prescription, q);
    case 'doctor':
      return answerDoctor(prescription);
    case 'date':
      return present(
        'date',
        prescription.date,
        (v) => `Your prescription is dated ${v}.`,
        'There is no date recorded in this prescription.',
      );
    case 'tests':
      return answerTests(prescription);
    case 'followUp':
      return answerFollowUp(prescription);
    case 'diagnosis':
      return answerDiagnosis(prescription);
    case 'instructions':
      return answerInstructions(prescription);
    case 'vitalsOverview':
      return answerVitalsOverview(prescription);
    case 'medications':
    case 'medicationDetail':
      return answerMedications(prescription, q, history, medicineHint, intent);
    case 'unknown':
    default: {
      // General medical / unrelated → refuse rather than invent.
      if (looksLikeGeneralMedical(q)) {
        return {
          answer: OUT_OF_SCOPE_EN,
          found: false,
          reason: 'OUT_OF_SCOPE',
          source: null,
        };
      }
      return notFound(null, 'I could not find that detail in your prescription.');
    }
  }
}

/**
 * Multilingual keyword intent detection (English + Indic scripts).
 * @param {string} question
 * @returns {string[]}
 */
export function detectIntentsMultilingual(question) {
  const q = question.toLowerCase();
  /** @type {string[]} */
  const intents = [];

  // Explicitly unsupported labs/values → not found (never invent)
  if (
    /\b(cholesterol|creatinine|hemoglobin|haemoglobin|tsh|platelet|wbc|rbc|hdl|ldl|triglyceride|uric\s*acid|vitamin\s*d)\b/i.test(
      q,
    )
  ) {
    return ['unknown'];
  }

  if (
    /\b(bp|blood\s*pressure|systolic|diastolic)\b/.test(q)
    || /ब्लड\s*प्रेशर|बीपी|रक्तचाप/.test(question)
    || /ರಕ್ತದೊತ್ತಡ|ಬಿಪಿ|ಬ್ಲಡ್\s*ಪ್ರೆಶರ್/.test(question)
    || /இரத்த\s*அழுத்த|பிபி/.test(question)
    || /రక్తపోటు|బిపి/.test(question)
  ) {
    intents.push('bloodPressure');
  }

  if (
    /\b(sugar|glucose|blood\s*sugar|bs|rbs|fbs|ppbs|hba1c)\b/.test(q)
    || /शुगर|ब्लड\s*शुगर|ग्लूकोज|शर्करा/.test(question)
    || /ಶುಗರ್|ರಕ್ತದ\s*ಸಕ್ಕರೆ/.test(question)
    || /சர்க்கரை|குளுக்கோஸ்/.test(question)
    || /షుగర్|చక్కెర/.test(question)
  ) {
    intents.push('bloodSugar');
  }

  if (/\b(temp|temperature|fever)\b/.test(q) || /बुखार|तापमान|ಜ್ವರ|காய்ச்சல்|జ్వరం/.test(question)) {
    intents.push('temperature');
  }
  if (/\b(pulse|heart\s*rate|bpm)\b/.test(q) || /नाड़ी|ಪಲ್ಸ್|நாடி/.test(question)) {
    intents.push('pulse');
  }
  if (/\b(weight|kg|kgs)\b/.test(q) || /वजन|ತೂಕ|எடை|బరువు/.test(question)) {
    intents.push('weight');
  }
  if (/\b(spo2|oxygen|o2\s*sat)\b/.test(q)) intents.push('spo2');

  if (
    /\b(patient|my\s+name|age|gender|sex)\b/.test(q)
    || /मरीज|रोगी|ಹೆಸರು|வயது|పేరు/.test(question)
  ) {
    intents.push('patient');
  }

  if (
    /\b(doctor|physician|dr\.?|clinic|registration|who\s+prescribed)\b/.test(q)
    || /डॉक्टर|चिकित्सक|ವೈದ್ಯ|மருத்துவர்|వైద్యుడు/.test(question)
  ) {
    intents.push('doctor');
  }

  if (
    /\b(test|labs?|investigation|scan)\b/.test(q)
    || /जांच|टेस्ट|ಪರೀಕ್ಷೆ|பரிசோதனை|పరీక్ష/.test(question)
  ) {
    intents.push('tests');
  }

  if (
    /\b(follow[\s-]?up|next\s+visit|review)\b/.test(q)
    || /फॉलो\s*अप|ಮರುಪರಿಶೀಲನೆ|பின்தொடர்தல்/.test(question)
  ) {
    intents.push('followUp');
  }

  if (
    /\b(diagnos|condition|illness)\b/.test(q)
    || /निदान|ರೋಗನಿರ್ಣಯ|நோய்\.?கண்டறிதல்/.test(question)
  ) {
    intents.push('diagnosis');
  }

  if (
    /\b(date|when\s+was|prescribed\s+on)\b/.test(q)
    && !/\b(how\s+many\s+days|duration|take)\b/.test(q)
  ) {
    intents.push('date');
  }

  if (
    /\b(instruction|advice|note|additional\s+instructions?)\b/.test(q)
    || /निर्देश|ಸೂಚನೆ|வழிமுறை/.test(question)
  ) {
    intents.push('instructions');
  }

  if (
    /\b(medicine|medication|tablet|capsule|syrup|dose|dosage|duration|timing|how\s+many\s+days|when\s+should\s+i\s+take|frequency|drug|prescribed)\b/.test(q)
    || (/\b(before|after)\b/.test(q) && /\b(food|meal)\b/.test(q))
    || /दवा|दवाई|गोली|ಮಾತ್ರೆ|ಔಷಧ|மருந்து|மாத்திரை|మందు|మాత్ర/.test(question)
  ) {
    if (
      /\b(when\s+should\s+i\s+take|timing|dose|dosage|duration|how\s+many\s+days|frequency)\b/.test(q)
      || (/\b(before|after)\b/.test(q) && /\b(food|meal)\b/.test(q))
    ) {
      intents.unshift('medicationDetail');
    }
    intents.push('medications');
  }

  // General medical / mechanism questions are out of scope even if they
  // mention a medicine name or start with "what".
  if (looksLikeGeneralMedical(q)) {
    return ['outOfScope'];
  }

  if (intents.length === 0 && /\b(what|which|list|tell|show|क्या|ಯಾವ|என்ன|ఏమి)\b/.test(q + question)) {
    intents.push('medications', 'vitalsOverview');
  }

  return intents;
}

/**
 * @param {string} question
 * @param {Array<{ role: string, text: string }>} history
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 */
async function classifyIntentWithSarvam(question, history, prescription) {
  const medNames = (prescription.medications || [])
    .map((m) => asText(/** @type {Record<string, unknown>} */ (m).name))
    .filter(Boolean);

  const historyBlock = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.text}`)
    .join('\n');

  const system = [
    'You classify prescription questions for a grounded medical assistant.',
    'Return ONLY valid JSON with keys: intent, medicineName, outOfScope.',
    `intent must be one of: ${INTENTS.join(', ')}.`,
    'outOfScope=true for general medical advice, drug mechanisms, interactions, stopping/starting medicines, or anything not answerable from a prescription record.',
    'medicineName is the medicine from the list when the user refers to a specific one or "it/this/first"; otherwise null.',
    'Do not answer the medical question. Classify only.',
  ].join(' ');

  const user = [
    `Medicines in prescription: ${medNames.length ? medNames.join(', ') : '(none)'}`,
    historyBlock ? `Recent conversation:\n${historyBlock}` : 'Recent conversation: (none)',
    `Current question: ${question}`,
  ].join('\n\n');

  const result = await chatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0,
    maxTokens: 200,
  });

  const parsed = /** @type {Record<string, unknown>} */ (parseJsonFromModel(result.content));
  return {
    intent: typeof parsed.intent === 'string' ? parsed.intent : 'unknown',
    medicineName: typeof parsed.medicineName === 'string' ? parsed.medicineName : null,
    outOfScope: parsed.outOfScope === true,
  };
}

/**
 * @param {string} englishAnswer
 * @param {string} targetLanguage
 */
async function localizeAnswer(englishAnswer, targetLanguage) {
  if (!englishAnswer) return englishAnswer;
  if (targetLanguage === 'en-IN' || targetLanguage === 'en') return englishAnswer;

  try {
    const result = await translateText({
      input: englishAnswer,
      sourceLanguageCode: 'en-IN',
      targetLanguageCode: targetLanguage,
      model: 'mayura:v1',
    });
    return result.translatedText?.trim() || englishAnswer;
  } catch {
    return englishAnswer;
  }
}

/**
 * @param {string} question
 * @param {string | null | undefined} explicit
 */
function resolveResponseLanguage(question, explicit) {
  const normalized = normalizeLanguageCode(explicit || '');
  if (normalized && isSupportedLanguage(normalized)) return normalized;

  if (/[\u0C80-\u0CFF]/.test(question)) return 'kn-IN'; // Kannada
  if (/[\u0B80-\u0BFF]/.test(question)) return 'ta-IN'; // Tamil
  if (/[\u0C00-\u0C7F]/.test(question)) return 'te-IN'; // Telugu
  if (/[\u0D00-\u0D7F]/.test(question)) return 'ml-IN'; // Malayalam
  if (/[\u0900-\u097F]/.test(question)) return 'hi-IN'; // Devanagari → Hindi
  if (/[\u0A80-\u0AFF]/.test(question)) return 'gu-IN';
  if (/[\u0B00-\u0B7F]/.test(question)) return 'od-IN';
  if (/[\u0A00-\u0A7F]/.test(question)) return 'pa-IN';
  if (/[\u0980-\u09FF]/.test(question)) return 'bn-IN';

  return 'en-IN';
}

function isAmbiguousReference(question) {
  return /\b(it|this|that|the\s+first|the\s+second|the\s+medicine|यह|वो|ಅದು|ಇದು|அது|இது|అది)\b/i.test(
    question,
  );
}

function looksLikeGeneralMedical(q) {
  return /\b(what\s+is\s+\w+\s+used\s+for|side\s*effects?|can\s+i\s+take|with\s+milk|with\s+alcohol|should\s+i\s+stop|interaction|overdose|pregnant|breastfeed)\b/i.test(
    q,
  );
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      text: typeof item.text === 'string' ? item.text.slice(0, 500) : '',
    }))
    .filter((item) => item.text)
    .slice(-8);
}

function normalizePrescription(data) {
  const empty = createEmptyCanonicalPrescription();
  if (!data || typeof data !== 'object') return empty;
  const raw = /** @type {Record<string, unknown>} */ (data);
  return {
    ...empty,
    ...raw,
    patient: { ...empty.patient, ...(asObject(raw.patient) || {}) },
    doctor: { ...empty.doctor, ...(asObject(raw.doctor) || {}) },
    vitals: { ...empty.vitals, ...(asObject(raw.vitals) || {}) },
    followUp: { ...empty.followUp, ...(asObject(raw.followUp) || {}) },
    diagnosis: Array.isArray(raw.diagnosis) ? raw.diagnosis : [],
    medications: Array.isArray(raw.medications) ? raw.medications : [],
    tests: Array.isArray(raw.tests) ? raw.tests : [],
    additionalInstructions: Array.isArray(raw.additionalInstructions)
      ? raw.additionalInstructions
      : [],
  };
}

function vitalAnswer(field, value, label, found) {
  return present(
    field,
    value,
    found,
    `There is no ${label} value recorded in this prescription. ${NOT_FOUND_SUFFIX}`,
  );
}

function present(field, value, found, missing) {
  const text = asText(value);
  if (!text) return notFound(field, missing);
  return {
    answer: found(text),
    found: true,
    reason: null,
    source: field ? { field, type: 'prescription' } : null,
  };
}

function notFound(field, detail) {
  const message = detail.includes('Please contact')
    ? detail
    : `${detail} ${NOT_FOUND_SUFFIX}`;
  return {
    answer: `This information is not present in your prescription. ${message}`,
    found: false,
    reason: 'NOT_FOUND_IN_PRESCRIPTION',
    source: field ? { field, type: 'prescription' } : null,
  };
}

function answerPatient(prescription, q) {
  const patient = prescription.patient || {};
  if (/\bage\b|वയസ್ಸು|ವಯಸ್ಸು|வயது|వయసు|उम्र|आयु/.test(q)) {
    return present(
      'patient.age',
      patient.age,
      (v) => `Your prescription records the patient age as ${v}.`,
      `There is no age recorded in this prescription. ${NOT_FOUND_SUFFIX}`,
    );
  }
  if (/\b(gender|sex)\b|लिंग|ಲಿಂಗ|பாலினம்/.test(q)) {
    return present(
      'patient.gender',
      patient.gender,
      (v) => `Your prescription records the patient gender as ${v}.`,
      `There is no gender recorded in this prescription. ${NOT_FOUND_SUFFIX}`,
    );
  }
  if (/\bname\b|नाम|ಹೆಸರು|பெயர்|పేరు/.test(q)) {
    return present(
      'patient.name',
      patient.name,
      (v) => `Your prescription records the patient name as ${v}.`,
      `There is no patient name recorded in this prescription. ${NOT_FOUND_SUFFIX}`,
    );
  }

  const parts = [];
  if (asText(patient.name)) parts.push(`Name: ${patient.name}`);
  if (asText(patient.age)) parts.push(`Age: ${patient.age}`);
  if (asText(patient.gender)) parts.push(`Gender: ${patient.gender}`);
  if (!parts.length) {
    return notFound('patient', 'There is no patient information recorded in this prescription.');
  }
  return {
    answer: `Your prescription records the following patient details: ${parts.join('; ')}.`,
    found: true,
    reason: null,
    source: { field: 'patient', type: 'prescription' },
  };
}

function answerDoctor(prescription) {
  const doctor = prescription.doctor || {};
  const parts = [];
  if (asText(doctor.name)) parts.push(String(doctor.name));
  if (asText(doctor.registrationNumber)) parts.push(`Reg. no. ${doctor.registrationNumber}`);
  if (asText(doctor.clinic)) parts.push(`Clinic: ${doctor.clinic}`);
  if (!parts.length) {
    return notFound('doctor', 'There is no doctor information recorded in this prescription.');
  }
  return {
    answer: `Your prescription records the doctor as ${parts.join(' · ')}.`,
    found: true,
    reason: null,
    source: { field: 'doctor', type: 'prescription' },
  };
}

function answerMedications(prescription, q, history, medicineHint, intent) {
  const meds = (prescription.medications || []).filter(
    (m) => m && asText(/** @type {Record<string, unknown>} */ (m).name),
  );
  if (!meds.length) {
    return notFound('medications', 'There are no medicines recorded in this prescription.');
  }

  const wantsDetail =
    intent === 'medicationDetail'
    || /\b(dose|dosage|duration|timing|when|how\s+many|how\s+long|take|instruction)\b/.test(q)
    || isAmbiguousReference(q)
    || Boolean(medicineHint);

  if (wantsDetail) {
    let selected = meds;
    if (medicineHint) {
      const hint = medicineHint.toLowerCase();
      const matched = meds.filter((raw) => {
        const name = asText(/** @type {Record<string, unknown>} */ (raw).name)?.toLowerCase() || '';
        return name.includes(hint) || hint.includes(name);
      });
      if (matched.length) selected = matched;
    } else if (/\bfirst\b|1st|पहली|ಮೊದಲ|முதல்/.test(q)) {
      selected = [meds[0]];
    } else if (/\bsecond\b|2nd|दूसरी|ಎರಡನೇ/.test(q) && meds[1]) {
      selected = [meds[1]];
    } else if (isAmbiguousReference(q) && history.length) {
      // Default to first medicine when resolving "it" after a medicine list.
      selected = [meds[0]];
    }

    const lines = selected.map((raw) => formatMedicineDetail(raw));
    const missingTiming = selected.every((raw) => {
      const m = /** @type {Record<string, unknown>} */ (raw);
      return !asText(m.timing) && !asText(m.instructions);
    });
    if (/\b(when|before|after|food|meal|timing)\b/.test(q) && missingTiming) {
      return {
        answer: `The prescription does not specify whether to take this medicine before or after food. ${NOT_FOUND_SUFFIX}`,
        found: false,
        reason: 'NOT_FOUND_IN_PRESCRIPTION',
        source: { field: 'medications', type: 'prescription' },
      };
    }

    return {
      answer: `According to your prescription: ${lines.join('; ')}.`,
      found: true,
      reason: null,
      source: { field: 'medications', type: 'prescription' },
    };
  }

  // Full list
  const blocks = meds.map((raw, index) => {
    const m = /** @type {Record<string, unknown>} */ (raw);
    const title = [asText(m.name), asText(m.strength)].filter(Boolean).join(' ');
    /** @type {string[]} */
    const bits = [];
    const dose = asText(m.dose) || asText(m.frequency);
    if (dose) bits.push(`Dosage: ${dose}`);
    if (asText(m.duration)) bits.push(`Duration: ${m.duration}`);
    if (asText(m.timing)) bits.push(`Timing: ${m.timing}`);
    if (asText(m.instructions)) bits.push(`Instructions: ${m.instructions}`);
    return bits.length
      ? `${index + 1}. ${title}\n   ${bits.join('\n   ')}`
      : `${index + 1}. ${title}`;
  });

  return {
    answer:
      meds.length === 1
        ? `Your prescription contains ${formatMedicineDetail(meds[0])}.`
        : `Your prescription contains ${meds.length} medicines:\n\n${blocks.join('\n\n')}`,
    found: true,
    reason: null,
    source: { field: 'medications', type: 'prescription' },
  };
}

function formatMedicineDetail(raw) {
  const m = /** @type {Record<string, unknown>} */ (raw);
  const title = [asText(m.name), asText(m.strength)].filter(Boolean).join(' ');
  const bits = [];
  const dose = asText(m.dose) || asText(m.frequency);
  if (dose) bits.push(`dosage ${dose}`);
  if (asText(m.duration)) bits.push(`duration ${m.duration}`);
  if (asText(m.timing)) bits.push(`timing ${m.timing}`);
  if (asText(m.instructions)) bits.push(String(m.instructions));
  return bits.length ? `${title} (${bits.join(', ')})` : title;
}

function answerTests(prescription) {
  const tests = (prescription.tests || []).filter(
    (t) => t && asText(/** @type {Record<string, unknown>} */ (t).name),
  );
  if (!tests.length) {
    return notFound('tests', 'There are no tests recorded in this prescription.');
  }
  const lines = tests.map((raw) => {
    const t = /** @type {Record<string, unknown>} */ (raw);
    return asText(t.instructions) ? `${t.name} (${t.instructions})` : String(t.name);
  });
  return {
    answer: `Your prescription lists these tests: ${lines.join('; ')}.`,
    found: true,
    reason: null,
    source: { field: 'tests', type: 'prescription' },
  };
}

function answerFollowUp(prescription) {
  const followUp = prescription.followUp || {};
  const parts = [];
  if (asText(followUp.date)) parts.push(`date ${followUp.date}`);
  if (asText(followUp.instructions)) parts.push(String(followUp.instructions));
  if (!parts.length) {
    return notFound('followUp', 'There is no follow-up recorded in this prescription.');
  }
  return {
    answer: `Your prescription records follow-up as: ${parts.join(' — ')}.`,
    found: true,
    reason: null,
    source: { field: 'followUp', type: 'prescription' },
  };
}

function answerDiagnosis(prescription) {
  const list = (prescription.diagnosis || []).map(asText).filter(Boolean);
  if (!list.length) {
    return notFound('diagnosis', 'There is no diagnosis recorded in this prescription.');
  }
  return {
    answer: `Your prescription records diagnosis as: ${list.join('; ')}.`,
    found: true,
    reason: null,
    source: { field: 'diagnosis', type: 'prescription' },
  };
}

function answerInstructions(prescription) {
  const list = (prescription.additionalInstructions || []).map(asText).filter(Boolean);
  const follow = asText(prescription.followUp?.instructions);
  const medNotes = (prescription.medications || [])
    .map((raw) => {
      const m = /** @type {Record<string, unknown>} */ (raw);
      const note = asText(m.instructions) || asText(m.timing);
      return note && asText(m.name) ? `${m.name}: ${note}` : note;
    })
    .filter(Boolean);

  const all = [...list, ...(follow ? [follow] : []), ...medNotes];
  if (!all.length) {
    return notFound(
      'additionalInstructions',
      'There are no additional instructions recorded in this prescription.',
    );
  }
  return {
    answer: `Your prescription includes these instructions: ${all.join('; ')}.`,
    found: true,
    reason: null,
    source: { field: 'additionalInstructions', type: 'prescription' },
  };
}

function answerVitalsOverview(prescription) {
  const v = prescription.vitals || {};
  const parts = [];
  if (asText(v.bloodPressure)) parts.push(`Blood pressure ${v.bloodPressure}`);
  if (asText(v.bloodSugar)) parts.push(`Blood sugar ${v.bloodSugar}`);
  if (asText(v.temperature)) parts.push(`Temperature ${v.temperature}`);
  if (asText(v.pulse)) parts.push(`Pulse ${v.pulse}`);
  if (asText(v.weight)) parts.push(`Weight ${v.weight}`);
  if (asText(v.spo2)) parts.push(`SpO2 ${v.spo2}`);
  if (!parts.length) return null;
  return {
    answer: `Your prescription records these vitals: ${parts.join('; ')}.`,
    found: true,
    reason: null,
    source: { field: 'vitals', type: 'prescription' },
  };
}

function asText(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'n/a') {
    return null;
  }
  return trimmed;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
}

export { PRIMARY_TARGET_LANGUAGES, resolveResponseLanguage };

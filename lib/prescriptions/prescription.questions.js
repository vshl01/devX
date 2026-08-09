/**
 * Grounded prescription Q&A — answers only from canonical structured data.
 * Never invents vitals, medicines, or diagnoses.
 */

import { AppError, ErrorCodes } from '../utils/errors.js';
import { createEmptyCanonicalPrescription } from './prescription.mapper.js';

const NOT_FOUND_PREFIX = 'This information is not present in your prescription.';

/**
 * @param {string} prescriptionId
 * @param {string} question
 */
export async function answerPrescriptionQuestion(prescriptionId, question) {
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
  return answerFromPrescription(prescription, trimmed);
}

/**
 * @param {unknown} data
 */
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

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 * @param {string} question
 */
export function answerFromPrescription(prescription, question) {
  const q = question.toLowerCase();
  const intents = detectIntents(q);

  for (const intent of intents) {
    const result = resolveIntent(intent, prescription, q);
    if (result) return result;
  }

  return notFound(null, 'I could not find that detail in your prescription.');
}

/**
 * @param {string} q
 * @returns {string[]}
 */
function detectIntents(q) {
  /** @type {string[]} */
  const intents = [];

  if (/\b(bp|blood\s*pressure|systolic|diastolic)\b/.test(q)) intents.push('bloodPressure');
  if (/\b(sugar|glucose|blood\s*sugar|bs|rbs|fbs|ppbs|hba1c)\b/.test(q)) intents.push('bloodSugar');
  if (/\b(temp|temperature|fever)\b/.test(q)) intents.push('temperature');
  if (/\b(pulse|heart\s*rate|bpm)\b/.test(q)) intents.push('pulse');
  if (/\b(weight|kg|kgs)\b/.test(q)) intents.push('weight');
  if (/\b(spo2|oxygen|o2\s*sat)\b/.test(q)) intents.push('spo2');
  if (/\b(patient|my\s+name|age|gender|sex)\b/.test(q)) intents.push('patient');
  if (/\b(doctor|physician|dr\.?|clinic|registration)\b/.test(q)) intents.push('doctor');
  if (/\b(test|labs?|investigation|scan)\b/.test(q)) intents.push('tests');
  if (/\b(follow[\s-]?up|next\s+visit|review)\b/.test(q)) intents.push('followUp');
  if (/\b(diagnos|condition|illness)\b/.test(q)) intents.push('diagnosis');
  if (/\b(date|when\s+was|prescribed\s+on)\b/.test(q)) intents.push('date');
  if (/\b(instruction|advice|note)\b/.test(q)) intents.push('instructions');
  if (
    /\b(medicine|medication|tablet|capsule|syrup|dose|dosage|duration|timing|how\s+many\s+days|when\s+should\s+i\s+take|frequency|drug)\b/.test(q)
  ) {
    intents.push('medications');
  }

  // Default: if asking "what was prescribed" style without specific field
  if (intents.length === 0 && /\b(what|which|list|tell|show|prescrib)\b/.test(q)) {
    intents.push('medications', 'vitalsOverview');
  }

  if (intents.length === 0) intents.push('unknown');
  return intents;
}

/**
 * @param {string} intent
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 * @param {string} q
 */
function resolveIntent(intent, prescription, q) {
  const vitals = prescription.vitals || {};

  switch (intent) {
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
    case 'tests':
      return answerTests(prescription);
    case 'followUp':
      return answerFollowUp(prescription);
    case 'diagnosis':
      return answerDiagnosis(prescription);
    case 'date':
      return present(
        'date',
        prescription.date,
        (v) => `Your prescription is dated ${v}.`,
        'There is no date recorded in this prescription.',
      );
    case 'instructions':
      return answerInstructions(prescription);
    case 'medications':
      return answerMedications(prescription, q);
    case 'vitalsOverview':
      return answerVitalsOverview(prescription);
    default:
      return null;
  }
}

/**
 * @param {string} field
 * @param {unknown} value
 * @param {string} label
 * @param {(v: string) => string} found
 */
function vitalAnswer(field, value, label, found) {
  return present(
    field,
    value,
    found,
    `There is no ${label} value recorded in this prescription.`,
  );
}

/**
 * @param {string | null} field
 * @param {unknown} value
 * @param {(v: string) => string} found
 * @param {string} missing
 */
function present(field, value, found, missing) {
  const text = asText(value);
  if (!text) return notFound(field, missing);
  return {
    answer: found(text),
    found: true,
    source: field ? { field } : null,
  };
}

/**
 * @param {string | null} field
 * @param {string} detail
 */
function notFound(field, detail) {
  return {
    answer: `${NOT_FOUND_PREFIX} ${detail}`,
    found: false,
    source: field ? { field } : null,
  };
}

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 * @param {string} q
 */
function answerPatient(prescription, q) {
  const patient = prescription.patient || {};
  if (/\bage\b/.test(q)) {
    return present(
      'patient.age',
      patient.age,
      (v) => `Your prescription records the patient age as ${v}.`,
      'There is no age recorded in this prescription.',
    );
  }
  if (/\b(gender|sex)\b/.test(q)) {
    return present(
      'patient.gender',
      patient.gender,
      (v) => `Your prescription records the patient gender as ${v}.`,
      'There is no gender recorded in this prescription.',
    );
  }
  if (/\bname\b/.test(q)) {
    return present(
      'patient.name',
      patient.name,
      (v) => `Your prescription records the patient name as ${v}.`,
      'There is no patient name recorded in this prescription.',
    );
  }

  const parts = [];
  if (asText(patient.name)) parts.push(`Name: ${patient.name}`);
  if (asText(patient.age)) parts.push(`Age: ${patient.age}`);
  if (asText(patient.gender)) parts.push(`Gender: ${patient.gender}`);
  if (parts.length === 0) {
    return notFound('patient', 'There is no patient information recorded in this prescription.');
  }
  return {
    answer: `Your prescription records the following patient details: ${parts.join('; ')}.`,
    found: true,
    source: { field: 'patient' },
  };
}

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 */
function answerDoctor(prescription) {
  const doctor = prescription.doctor || {};
  const parts = [];
  if (asText(doctor.name)) parts.push(String(doctor.name));
  if (asText(doctor.registrationNumber)) parts.push(`Reg. no. ${doctor.registrationNumber}`);
  if (asText(doctor.clinic)) parts.push(`Clinic: ${doctor.clinic}`);
  if (parts.length === 0) {
    return notFound('doctor', 'There is no doctor information recorded in this prescription.');
  }
  return {
    answer: `Your prescription records the doctor as ${parts.join(' · ')}.`,
    found: true,
    source: { field: 'doctor' },
  };
}

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 * @param {string} q
 */
function answerMedications(prescription, q) {
  const meds = (prescription.medications || []).filter((m) => m && asText(/** @type {Record<string, unknown>} */ (m).name));
  if (meds.length === 0) {
    return notFound('medications', 'There are no medicines recorded in this prescription.');
  }

  const wantsDuration = /\b(day|days|duration|how\s+long|how\s+many)\b/.test(q);
  const wantsTiming = /\b(when|timing|after\s+food|before\s+food|take)\b/.test(q);
  const wantsDose = /\b(dose|dosage|frequency|how\s+often|1\s*-\s*0\s*-\s*1)\b/.test(q);

  if (wantsDuration || wantsTiming || wantsDose) {
    const lines = meds.map((raw) => {
      const m = /** @type {Record<string, unknown>} */ (raw);
      const name = [asText(m.name), asText(m.strength)].filter(Boolean).join(' ');
      /** @type {string[]} */
      const bits = [];
      if (wantsDose) {
        const dose = asText(m.dose) || asText(m.frequency);
        if (dose) bits.push(`dosage ${dose}`);
      }
      if (wantsTiming && asText(m.timing)) bits.push(`timing ${m.timing}`);
      if (wantsDuration && asText(m.duration)) bits.push(`duration ${m.duration}`);
      if (bits.length === 0) {
        const fallback = [
          asText(m.dose) || asText(m.frequency),
          asText(m.timing),
          asText(m.duration),
        ].filter(Boolean);
        return fallback.length ? `${name}: ${fallback.join(' · ')}` : name;
      }
      return `${name}: ${bits.join(', ')}`;
    });
    return {
      answer: `According to your prescription: ${lines.join('; ')}.`,
      found: true,
      source: { field: 'medications' },
    };
  }

  const summary = meds.map((raw) => {
    const m = /** @type {Record<string, unknown>} */ (raw);
    return [
      asText(m.name),
      asText(m.strength),
      asText(m.dose) || asText(m.frequency),
      asText(m.duration),
    ]
      .filter(Boolean)
      .join(' ');
  });

  return {
    answer: `Your prescription lists these medicines: ${summary.join('; ')}.`,
    found: true,
    source: { field: 'medications' },
  };
}

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 */
function answerTests(prescription) {
  const tests = (prescription.tests || []).filter((t) => t && asText(/** @type {Record<string, unknown>} */ (t).name));
  if (tests.length === 0) {
    return notFound('tests', 'There are no tests recorded in this prescription.');
  }
  const lines = tests.map((raw) => {
    const t = /** @type {Record<string, unknown>} */ (raw);
    return asText(t.instructions)
      ? `${t.name} (${t.instructions})`
      : String(t.name);
  });
  return {
    answer: `Your prescription lists these tests: ${lines.join('; ')}.`,
    found: true,
    source: { field: 'tests' },
  };
}

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 */
function answerFollowUp(prescription) {
  const followUp = prescription.followUp || {};
  const parts = [];
  if (asText(followUp.date)) parts.push(`date ${followUp.date}`);
  if (asText(followUp.instructions)) parts.push(String(followUp.instructions));
  if (parts.length === 0) {
    return notFound('followUp', 'There is no follow-up recorded in this prescription.');
  }
  return {
    answer: `Your prescription records follow-up as: ${parts.join(' — ')}.`,
    found: true,
    source: { field: 'followUp' },
  };
}

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 */
function answerDiagnosis(prescription) {
  const list = (prescription.diagnosis || []).map(asText).filter(Boolean);
  if (list.length === 0) {
    return notFound('diagnosis', 'There is no diagnosis recorded in this prescription.');
  }
  return {
    answer: `Your prescription records diagnosis as: ${list.join('; ')}.`,
    found: true,
    source: { field: 'diagnosis' },
  };
}

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 */
function answerInstructions(prescription) {
  const list = (prescription.additionalInstructions || []).map(asText).filter(Boolean);
  const follow = asText(prescription.followUp?.instructions);
  const medNotes = (prescription.medications || [])
    .map((raw) => {
      const m = /** @type {Record<string, unknown>} */ (raw);
      const note = asText(m.instructions);
      return note && asText(m.name) ? `${m.name}: ${note}` : note;
    })
    .filter(Boolean);

  const all = [...list, ...(follow ? [follow] : []), ...medNotes];
  if (all.length === 0) {
    return notFound(
      'additionalInstructions',
      'There are no additional instructions recorded in this prescription.',
    );
  }
  return {
    answer: `Your prescription includes these instructions: ${all.join('; ')}.`,
    found: true,
    source: { field: 'additionalInstructions' },
  };
}

/**
 * @param {ReturnType<typeof createEmptyCanonicalPrescription>} prescription
 */
function answerVitalsOverview(prescription) {
  const v = prescription.vitals || {};
  const parts = [];
  if (asText(v.bloodPressure)) parts.push(`Blood pressure ${v.bloodPressure}`);
  if (asText(v.bloodSugar)) parts.push(`Blood sugar ${v.bloodSugar}`);
  if (asText(v.temperature)) parts.push(`Temperature ${v.temperature}`);
  if (asText(v.pulse)) parts.push(`Pulse ${v.pulse}`);
  if (asText(v.weight)) parts.push(`Weight ${v.weight}`);
  if (asText(v.spo2)) parts.push(`SpO2 ${v.spo2}`);
  if (parts.length === 0) return null;
  return {
    answer: `Your prescription records these vitals: ${parts.join('; ')}.`,
    found: true,
    source: { field: 'vitals' },
  };
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
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

/**
 * @param {unknown} value
 */
function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
}

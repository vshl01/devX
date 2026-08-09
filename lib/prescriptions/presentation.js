/**
 * Structured prescription presentation for UI + Sarvam translation.
 *
 * English labels here are SOURCE TEXT sent to Sarvam — not a frontend i18n map.
 * Missing fields are omitted. Layout mirrors the Original AI Understanding panel.
 */

export const PRESENTATION_KIND = 'presentation';
/** Bump when translation payload/shape changes so stale DB cache regenerates. */
export const PRESENTATION_VERSION = 4;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function text(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || /^n\/?a$/i.test(trimmed) || /^null$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
}

/**
 * @param {string} key
 */
function humanizeKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Values that are mostly identifiers/numbers should not be sent for free translation.
 * Phrases with words (timing, duration with "days", instructions) should.
 *
 * @param {string} value
 * @param {'identity' | 'phrase' | 'auto'} mode
 */
export function shouldTranslateValue(value, mode = 'auto') {
  if (mode === 'identity') return false;
  if (mode === 'phrase') return true;
  // auto: skip pure numbers / dose patterns / short codes
  if (/^[\d./\-\s:xX]+$/.test(value)) return false;
  if (/^\d+\s*(mg|ml|mcg|g|%|mmhg|mg\/dl)?$/i.test(value)) return false;
  if (/^\d+\s*-\s*\d+\s*-\s*\d+$/.test(value)) return false;
  // Has letters beyond Latin medicine-ish short tokens alone — translate phrases
  return /[a-zA-Z\u0900-\u0D7F]/.test(value) && /[a-zA-Z]{3,}/.test(value);
}

/**
 * @param {string} key
 * @param {string} value
 * @param {Record<string, string>} labelMap
 */
function field(key, value, labelMap) {
  const mode = IDENTITY_VALUE_KEYS.has(key)
    ? 'identity'
    : PHRASE_VALUE_KEYS.has(key)
      ? 'phrase'
      : 'auto';
  return {
    key,
    label: labelMap[key] || humanizeKey(key),
    value,
    translateValue: shouldTranslateValue(value, mode),
  };
}

const IDENTITY_VALUE_KEYS = new Set([
  'name',
  'age',
  'gender',
  'registrationNumber',
  'bloodPressure',
  'bloodSugar',
  'temperature',
  'pulse',
  'weight',
  'spo2',
  'dose',
  'frequency',
  'strength',
]);

const PHRASE_VALUE_KEYS = new Set([
  'timing',
  'duration',
  'instructions',
  'form',
  'clinic',
]);

/**
 * @param {Record<string, unknown> | null} obj
 * @param {Record<string, string>} labelMap
 * @param {string[]} preferredOrder
 */
function collectFields(obj, labelMap, preferredOrder = []) {
  if (!obj) return [];
  /** @type {ReturnType<typeof field>[]} */
  const fields = [];
  const used = new Set();

  for (const key of preferredOrder) {
    const value = text(obj[key]);
    if (!value) continue;
    fields.push(field(key, value, labelMap));
    used.add(key);
  }

  for (const [key, raw] of Object.entries(obj)) {
    if (used.has(key)) continue;
    if (raw !== null && typeof raw === 'object') continue;
    if (key === 'verificationRequired') continue;
    const value = text(raw);
    if (!value) continue;
    fields.push(field(key, value, labelMap));
  }

  return fields;
}

/**
 * Build structured English presentation matching the Original UI layout.
 *
 * @param {unknown} canonical
 * @returns {{ kind: string, version: number, sections: object[] } | null}
 */
export function buildStructuredPresentation(canonical) {
  if (!canonical || typeof canonical !== 'object') return null;

  const data = /** @type {Record<string, unknown>} */ (canonical);
  /** @type {object[]} */
  const sections = [];

  const patientFields = collectFields(
    asObject(data.patient),
    { name: 'Name', age: 'Age', gender: 'Gender' },
    ['name', 'age', 'gender'],
  );
  if (patientFields.length) {
    sections.push({
      id: 'patient',
      type: 'fields',
      title: 'Patient',
      icon: 'user',
      fields: patientFields,
    });
  }

  const doctorFields = collectFields(
    asObject(data.doctor),
    {
      name: 'Name',
      registrationNumber: 'Registration',
      clinic: 'Clinic',
      specialization: 'Specialization',
    },
    ['name', 'registrationNumber', 'clinic', 'specialization'],
  );
  if (doctorFields.length) {
    sections.push({
      id: 'doctor',
      type: 'fields',
      title: 'Doctor',
      icon: 'stethoscope',
      fields: doctorFields,
    });
  }

  const date = text(data.date);
  if (date) {
    sections.push({
      id: 'date',
      type: 'fields',
      title: 'Date',
      icon: 'calendar',
      fields: [
        {
          key: 'date',
          label: 'Date',
          value: date,
          translateValue: false,
        },
      ],
    });
  }

  const vitalFields = collectFields(
    asObject(data.vitals),
    {
      bloodPressure: 'Blood Pressure',
      bloodSugar: 'Blood Sugar',
      temperature: 'Temperature',
      pulse: 'Pulse',
      weight: 'Weight',
      spo2: 'SpO2',
    },
    ['bloodPressure', 'bloodSugar', 'temperature', 'pulse', 'weight', 'spo2'],
  );
  if (vitalFields.length) {
    sections.push({
      id: 'vitals',
      type: 'fields',
      title: 'Vitals',
      icon: 'vitals',
      fields: vitalFields,
    });
  }

  const medications = Array.isArray(data.medications) ? data.medications : [];
  /** @type {object[]} */
  const cards = [];
  for (const raw of medications) {
    const med = asObject(raw);
    if (!med) continue;
    const name = text(med.name);
    const strength = text(med.strength);
    const title = [name, strength].filter(Boolean).join(' ');
    if (!title) continue;

    const dose = text(med.dose) || text(med.frequency);
    /** @type {ReturnType<typeof field>[]} */
    const fields = [];
    if (dose) {
      fields.push({
        key: 'dose',
        label: 'Dosage',
        value: dose,
        translateValue: false,
      });
    }
    const duration = text(med.duration);
    if (duration) {
      fields.push({
        key: 'duration',
        label: 'Duration',
        value: duration,
        translateValue: true,
      });
    }
    const timing = text(med.timing);
    if (timing) {
      fields.push({
        key: 'timing',
        label: 'Timing',
        value: timing,
        translateValue: true,
      });
    }
    const form = text(med.form);
    if (form) {
      fields.push({
        key: 'form',
        label: 'Form',
        value: form,
        translateValue: true,
      });
    }
    const instructions = text(med.instructions);
    if (instructions) {
      fields.push({
        key: 'instructions',
        label: 'Notes',
        value: instructions,
        translateValue: true,
      });
    }

    // Unexpected medication scalars
    for (const [key, rawValue] of Object.entries(med)) {
      if (
        [
          'name',
          'strength',
          'form',
          'dose',
          'frequency',
          'timing',
          'duration',
          'instructions',
          'verificationRequired',
        ].includes(key)
      ) {
        continue;
      }
      if (rawValue !== null && typeof rawValue === 'object') continue;
      const value = text(rawValue);
      if (!value) continue;
      fields.push(field(key, value, {}));
    }

    cards.push({
      title,
      translateTitle: false,
      verificationRequired: med.verificationRequired === true,
      fields,
    });
  }
  if (cards.length) {
    sections.push({
      id: 'medications',
      type: 'cards',
      title: 'Medicines',
      icon: 'pill',
      cards,
    });
  }

  const tests = Array.isArray(data.tests) ? data.tests : [];
  /** @type {object[]} */
  const testCards = [];
  for (const raw of tests) {
    const test = asObject(raw);
    if (!test) continue;
    const name = text(test.name);
    if (!name) continue;
    /** @type {ReturnType<typeof field>[]} */
    const fields = [];
    const instructions = text(test.instructions);
    if (instructions) {
      fields.push({
        key: 'instructions',
        label: 'Instructions',
        value: instructions,
        translateValue: true,
      });
    }
    testCards.push({
      title: name,
      translateTitle: shouldTranslateValue(name, 'phrase'),
      fields,
    });
  }
  if (testCards.length) {
    sections.push({
      id: 'tests',
      type: 'cards',
      title: 'Tests',
      icon: 'flask',
      cards: testCards,
    });
  }

  const diagnosis = Array.isArray(data.diagnosis)
    ? data.diagnosis.map(text).filter(Boolean)
    : [];
  if (diagnosis.length) {
    sections.push({
      id: 'diagnosis',
      type: 'list',
      title: 'Diagnosis',
      icon: 'stethoscope',
      items: diagnosis.map((item) => ({
        value: item,
        translateValue: true,
      })),
    });
  }

  const followUpFields = collectFields(
    asObject(data.followUp),
    { date: 'Date', instructions: 'Instructions' },
    ['date', 'instructions'],
  );
  if (followUpFields.length) {
    sections.push({
      id: 'followUp',
      type: 'fields',
      title: 'Follow-up',
      icon: 'calendar',
      fields: followUpFields,
    });
  }

  const additional = Array.isArray(data.additionalInstructions)
    ? data.additionalInstructions.map(text).filter(Boolean)
    : [];
  if (additional.length) {
    sections.push({
      id: 'additionalInstructions',
      type: 'list',
      title: 'Additional instructions',
      icon: 'vitals',
      items: additional.map((item) => ({
        value: item,
        translateValue: true,
      })),
    });
  }

  // Unexpected top-level content
  const reserved = new Set([
    'patient',
    'doctor',
    'date',
    'vitals',
    'diagnosis',
    'medications',
    'tests',
    'followUp',
    'additionalInstructions',
    'originalLanguage',
  ]);
  /** @type {ReturnType<typeof field>[]} */
  const extras = [];
  for (const [key, raw] of Object.entries(data)) {
    if (reserved.has(key)) continue;
    if (raw !== null && typeof raw === 'object') {
      const nested = asObject(raw);
      if (!nested) continue;
      const nestedFields = collectFields(nested, {}, []);
      if (nestedFields.length) {
        sections.push({
          id: `extra-${key}`,
          type: 'fields',
          title: humanizeKey(key),
          icon: 'vitals',
          fields: nestedFields,
        });
      }
      continue;
    }
    const value = text(raw);
    if (!value) continue;
    extras.push(field(key, value, {}));
  }
  if (extras.length) {
    sections.push({
      id: 'extra',
      type: 'fields',
      title: 'Other details',
      icon: 'vitals',
      fields: extras,
    });
  }

  if (!sections.length) return null;

  return {
    kind: PRESENTATION_KIND,
    version: PRESENTATION_VERSION,
    sections,
  };
}

/**
 * Collect unique strings that need Sarvam translation (labels + phrase values).
 *
 * @param {{ sections: object[] }} presentation
 * @returns {{ labels: string[], values: string[] }}
 */
export function collectTranslatableStrings(presentation) {
  /** @type {Set<string>} */
  const labels = new Set();
  /** @type {Set<string>} */
  const values = new Set();

  for (const section of presentation.sections || []) {
    if (typeof section.title === 'string' && section.title.trim()) {
      labels.add(section.title.trim());
    }
    for (const f of section.fields || []) {
      if (typeof f.label === 'string' && f.label.trim()) labels.add(f.label.trim());
      if (f.translateValue && typeof f.value === 'string' && f.value.trim()) {
        values.add(f.value.trim());
      }
    }
    for (const card of section.cards || []) {
      if (card.translateTitle && typeof card.title === 'string' && card.title.trim()) {
        values.add(card.title.trim());
      }
      for (const f of card.fields || []) {
        if (typeof f.label === 'string' && f.label.trim()) labels.add(f.label.trim());
        if (f.translateValue && typeof f.value === 'string' && f.value.trim()) {
          values.add(f.value.trim());
        }
      }
    }
    for (const item of section.items || []) {
      if (item.translateValue && typeof item.value === 'string' && item.value.trim()) {
        values.add(item.value.trim());
      }
    }
  }

  return {
    labels: [...labels],
    values: [...values],
  };
}

/**
 * Apply translated label/value maps onto a structured presentation (in place clone).
 *
 * @param {{ sections: object[] }} presentation
 * @param {Map<string, string>} labelMap
 * @param {Map<string, string>} valueMap
 */
export function applyTranslations(presentation, labelMap, valueMap) {
  const cloned = structuredClone(presentation);

  for (const section of cloned.sections || []) {
    if (typeof section.title === 'string' && labelMap.has(section.title)) {
      section.title = labelMap.get(section.title);
    }
    for (const f of section.fields || []) {
      if (typeof f.label === 'string' && labelMap.has(f.label)) {
        f.label = labelMap.get(f.label);
      }
      if (f.translateValue && typeof f.value === 'string' && valueMap.has(f.value)) {
        f.value = valueMap.get(f.value);
      }
      delete f.translateValue;
    }
    for (const card of section.cards || []) {
      if (card.translateTitle && typeof card.title === 'string' && valueMap.has(card.title)) {
        card.title = valueMap.get(card.title);
      }
      delete card.translateTitle;
      for (const f of card.fields || []) {
        if (typeof f.label === 'string' && labelMap.has(f.label)) {
          f.label = labelMap.get(f.label);
        }
        if (f.translateValue && typeof f.value === 'string' && valueMap.has(f.value)) {
          f.value = valueMap.get(f.value);
        }
        delete f.translateValue;
      }
    }
    for (const item of section.items || []) {
      if (item.translateValue && typeof item.value === 'string' && valueMap.has(item.value)) {
        item.value = valueMap.get(item.value);
      }
      delete item.translateValue;
    }
  }

  return cloned;
}

/**
 * @param {unknown} data
 * @returns {boolean}
 */
export function isPresentationTranslation(data) {
  if (!data || typeof data !== 'object') return false;
  const row = /** @type {Record<string, unknown>} */ (data);
  return (
    row.kind === PRESENTATION_KIND
    && Number(row.version) >= PRESENTATION_VERSION
    && Array.isArray(row.sections)
    && row.sections.length > 0
  );
}

/**
 * @param {object[]} sections
 * @param {string} targetLanguage
 */
export function createPresentationTranslation(sections, targetLanguage) {
  return {
    kind: PRESENTATION_KIND,
    version: PRESENTATION_VERSION,
    targetLanguage,
    sections,
  };
}

/** @deprecated kept for older tests — builds plain text from structured presentation */
export function buildPrescriptionPresentation(canonical) {
  const structured = buildStructuredPresentation(canonical);
  if (!structured) return '';
  /** @type {string[]} */
  const parts = [];
  for (const section of structured.sections) {
    /** @type {string[]} */
    const lines = [section.title];
    if (section.type === 'fields') {
      for (const f of section.fields || []) lines.push(`${f.label}: ${f.value}`);
    } else if (section.type === 'cards') {
      for (const card of section.cards || []) {
        lines.push('');
        lines.push(card.title);
        for (const f of card.fields || []) lines.push(`${f.label}: ${f.value}`);
      }
    } else if (section.type === 'list') {
      for (const item of section.items || []) lines.push(`- ${item.value}`);
    }
    parts.push(lines.filter((l, i) => i === 0 || l !== '').join('\n'));
  }
  return parts.join('\n\n').trim();
}

/**
 * Empty canonical prescription. Missing values stay null / [].
 */
export function createEmptyCanonicalPrescription() {
  return {
    patient: {
      name: null,
      age: null,
      gender: null,
    },
    doctor: {
      name: null,
      registrationNumber: null,
      clinic: null,
    },
    date: null,
    vitals: {
      bloodPressure: null,
      bloodSugar: null,
      temperature: null,
      pulse: null,
      weight: null,
      spo2: null,
    },
    diagnosis: [],
    medications: [],
    tests: [],
    followUp: {
      date: null,
      instructions: null,
    },
    additionalInstructions: [],
  };
}

/**
 * Map Sarvam extract result into the application canonical schema.
 * Never invents values — absent fields remain null / empty arrays.
 *
 * @param {unknown} extractResult
 * @param {{ annotations?: unknown }} [options]
 */
export function mapExtractResultToCanonical(extractResult, options = {}) {
  const base = createEmptyCanonicalPrescription();
  if (!extractResult || typeof extractResult !== 'object') {
    return { prescription: base, originalLanguage: null };
  }

  const raw = /** @type {Record<string, unknown>} */ (extractResult);
  const annotations = options.annotations && typeof options.annotations === 'object'
    ? /** @type {Record<string, unknown>} */ (options.annotations)
    : null;

  const patient = asObject(raw.patient);
  const doctor = asObject(raw.doctor);
  const vitals = asObject(raw.vitals);
  const followUp = asObject(raw.followUp);

  /** @type {ReturnType<typeof createEmptyCanonicalPrescription>} */
  const prescription = {
    patient: {
      name: nullableString(patient?.name),
      age: nullableString(patient?.age),
      gender: nullableString(patient?.gender),
    },
    doctor: {
      name: nullableString(doctor?.name),
      registrationNumber: nullableString(doctor?.registrationNumber),
      clinic: nullableString(doctor?.clinic),
    },
    date: nullableString(raw.date),
    vitals: {
      bloodPressure: nullableString(vitals?.bloodPressure),
      bloodSugar: nullableString(vitals?.bloodSugar),
      temperature: nullableString(vitals?.temperature),
      pulse: nullableString(vitals?.pulse),
      weight: nullableString(vitals?.weight),
      spo2: nullableString(vitals?.spo2),
    },
    diagnosis: stringArray(raw.diagnosis),
    medications: mapMedications(raw.medications, annotations),
    tests: mapTests(raw.tests),
    followUp: {
      date: nullableString(followUp?.date),
      instructions: nullableString(followUp?.instructions),
    },
    additionalInstructions: stringArray(raw.additionalInstructions),
  };

  return {
    prescription,
    originalLanguage: nullableString(raw.originalLanguage),
  };
}

/**
 * @param {unknown} value
 */
function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function nullableString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'n/a') {
    return null;
  }
  return trimmed;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function stringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => nullableString(item))
    .filter((item) => item !== null);
}

/**
 * @param {unknown} value
 * @param {Record<string, unknown> | null} annotations
 */
function mapMedications(value, annotations) {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const med = asObject(item) || {};
    const name = nullableString(med.name);
    const verificationFromModel = med.verificationRequired === true;
    const lowConfidence = isLowConfidenceMedication(annotations, index);
    const unclear = Boolean(
      verificationFromModel
      || lowConfidence
      || (name && /unclear|illegible|unknown/i.test(name)),
    );

    return {
      name: name || (unclear ? 'unclear text' : null),
      strength: nullableString(med.strength),
      form: nullableString(med.form),
      dose: nullableString(med.dose),
      frequency: nullableString(med.frequency),
      timing: nullableString(med.timing),
      duration: nullableString(med.duration),
      instructions: nullableString(med.instructions),
      ...(unclear ? { verificationRequired: true } : {}),
    };
  });
}

/**
 * @param {unknown} value
 */
function mapTests(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const test = asObject(item) || {};
    return {
      name: nullableString(test.name),
      instructions: nullableString(test.instructions),
    };
  });
}

/**
 * Preserve Sarvam confidence when present; do not invent scores.
 *
 * @param {Record<string, unknown> | null} annotations
 * @param {number} index
 */
function isLowConfidenceMedication(annotations, index) {
  if (!annotations) return false;
  const medications = annotations.medications;
  if (!Array.isArray(medications) || !medications[index]) return false;
  const medAnn = medications[index];
  if (!medAnn || typeof medAnn !== 'object') return false;

  const nameAnn = /** @type {Record<string, unknown>} */ (medAnn).name;
  if (!nameAnn || typeof nameAnn !== 'object') return false;
  const confidence = /** @type {Record<string, unknown>} */ (nameAnn).confidence;
  return typeof confidence === 'number' && confidence < 0.5;
}

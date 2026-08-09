/** @typedef {'CREATED'|'UPLOADING'|'DIGITISING'|'EXTRACTING'|'TRANSLATING'|'COMPLETED'|'PARTIALLY_COMPLETED'|'FAILED'} PrescriptionStatus */

export const PrescriptionStatus = Object.freeze({
  CREATED: 'CREATED',
  UPLOADING: 'UPLOADING',
  DIGITISING: 'DIGITISING',
  EXTRACTING: 'EXTRACTING',
  TRANSLATING: 'TRANSLATING',
  COMPLETED: 'COMPLETED',
  PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
  FAILED: 'FAILED',
});

/** Statuses that mean processing is still in progress. */
export const ACTIVE_PROCESSING_STATUSES = Object.freeze([
  PrescriptionStatus.CREATED,
  PrescriptionStatus.UPLOADING,
  PrescriptionStatus.DIGITISING,
  PrescriptionStatus.EXTRACTING,
  PrescriptionStatus.TRANSLATING,
]);

/**
 * Allowed forward transitions. FAILED can be reached from any non-terminal state.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  [PrescriptionStatus.CREATED]: [
    PrescriptionStatus.UPLOADING,
    PrescriptionStatus.DIGITISING,
    PrescriptionStatus.FAILED,
  ],
  [PrescriptionStatus.UPLOADING]: [
    PrescriptionStatus.DIGITISING,
    PrescriptionStatus.FAILED,
  ],
  [PrescriptionStatus.DIGITISING]: [
    PrescriptionStatus.EXTRACTING,
    PrescriptionStatus.PARTIALLY_COMPLETED,
    PrescriptionStatus.FAILED,
  ],
  [PrescriptionStatus.EXTRACTING]: [
    PrescriptionStatus.TRANSLATING,
    PrescriptionStatus.COMPLETED,
    PrescriptionStatus.PARTIALLY_COMPLETED,
    PrescriptionStatus.FAILED,
  ],
  [PrescriptionStatus.TRANSLATING]: [
    PrescriptionStatus.COMPLETED,
    PrescriptionStatus.PARTIALLY_COMPLETED,
    PrescriptionStatus.FAILED,
  ],
  [PrescriptionStatus.COMPLETED]: [],
  [PrescriptionStatus.PARTIALLY_COMPLETED]: [
    PrescriptionStatus.TRANSLATING,
    PrescriptionStatus.COMPLETED,
    PrescriptionStatus.FAILED,
  ],
  [PrescriptionStatus.FAILED]: [],
});

/**
 * @param {string} from
 * @param {string} to
 */
export function canTransitionStatus(from, to) {
  if (from === to) return true;
  const allowed = ALLOWED_STATUS_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** Canonical prescription shape returned by the API. */

export type PrescriptionStatus =
  | "CREATED"
  | "UPLOADING"
  | "DIGITISING"
  | "EXTRACTING"
  | "TRANSLATING"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "FAILED"
  | "PROCESSING";

export interface PatientInfo {
  name: string | null;
  age: string | null;
  gender: string | null;
}

export interface DoctorInfo {
  name: string | null;
  registrationNumber: string | null;
  clinic: string | null;
}

export interface VitalsInfo {
  bloodPressure: string | null;
  bloodSugar: string | null;
  temperature: string | null;
  pulse: string | null;
  weight: string | null;
  spo2: string | null;
}

export interface MedicationInfo {
  name: string | null;
  strength: string | null;
  form: string | null;
  dose: string | null;
  frequency: string | null;
  timing: string | null;
  duration: string | null;
  instructions: string | null;
  verificationRequired?: boolean;
}

export interface TestInfo {
  name: string | null;
  instructions: string | null;
}

export interface FollowUpInfo {
  date: string | null;
  instructions: string | null;
}

export interface CanonicalPrescription {
  patient: PatientInfo;
  doctor: DoctorInfo;
  date: string | null;
  vitals: VitalsInfo;
  diagnosis: string[];
  medications: MedicationInfo[];
  tests: TestInfo[];
  followUp: FollowUpInfo;
  additionalInstructions: string[];
}

/** Structured translation produced by Sarvam (same layout as Original). */
export interface TranslationField {
  key: string;
  label: string;
  value: string;
  translateValue?: boolean;
}

export interface TranslationCard {
  title: string;
  translateTitle?: boolean;
  verificationRequired?: boolean;
  fields: TranslationField[];
}

export interface TranslationListItem {
  value: string;
  translateValue?: boolean;
}

export interface TranslationSection {
  id: string;
  type: "fields" | "cards" | "list";
  title: string;
  icon?: string;
  fields?: TranslationField[];
  cards?: TranslationCard[];
  items?: TranslationListItem[];
}

export interface TranslatedPresentation {
  kind: "presentation";
  version: number;
  targetLanguage?: string;
  /** Structured sections — preferred (v3+) */
  sections?: TranslationSection[];
  /** Legacy paragraph form (v2) */
  text?: string;
}

export interface PrescriptionTranslation {
  id: string;
  targetLanguage: string;
  translatedData: TranslatedPresentation | CanonicalPrescription | Record<string, unknown>;
  createdAt: string;
}

export interface PrescriptionRecord {
  id: string;
  status: PrescriptionStatus;
  originalFileName?: string;
  originalMimeType?: string;
  fileUrl?: string;
  originalLanguage: string | null;
  rawText: string | null;
  prescription: CanonicalPrescription | null;
  targetLanguage: string | null;
  translations: PrescriptionTranslation[];
  error: { code: string; message: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface QuestionAnswer {
  answer: string;
  found: boolean;
  grounded?: boolean;
  reason?: string | null;
  language?: string;
  source?: { field: string; type?: string } | null;
  audio?: { mimeType: string; base64: string } | null;
}

export function isTranslatedPresentation(value: unknown): value is TranslatedPresentation {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (data.kind !== "presentation") return false;
  return Number(data.version) >= 4 && Array.isArray(data.sections) && data.sections.length > 0;
}

export const PRIMARY_LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "ml-IN", label: "Malayalam" },
] as const;

export const TERMINAL_STATUSES: PrescriptionStatus[] = [
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "FAILED",
];

export function isProcessingStatus(status: PrescriptionStatus): boolean {
  return !TERMINAL_STATUSES.includes(status) && status !== "FAILED";
}

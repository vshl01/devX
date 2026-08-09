import type {
  ApiResponse,
  PrescriptionRecord,
  QuestionAnswer,
  TranslatedPresentation,
} from "@/types/prescription";
import { isTranslatedPresentation } from "@/types/prescription";

export class PrescriptionApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "REQUEST_FAILED", status = 500) {
    super(message);
    this.name = "PrescriptionApiError";
    this.code = code;
    this.status = status;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.success) {
    throw new PrescriptionApiError(
      humanizeError(payload.error?.message, response.status),
      payload.error?.code ?? "REQUEST_FAILED",
      response.status,
    );
  }
  return payload.data;
}

function humanizeError(message: string | undefined, status: number): string {
  if (message && !/internal server error|unexpected/i.test(message)) {
    return message;
  }
  if (status === 413) return "That file is too large. Please upload a smaller image or PDF.";
  if (status === 415) return "Please upload a JPG, PNG, or PDF prescription.";
  if (status === 404) return "We could not find that prescription.";
  if (status === 409) return "Your prescription is still being processed. Please wait a moment.";
  return "We couldn't process this prescription. Please try again or upload a clearer image.";
}

export async function uploadPrescription(
  file: File,
  targetLanguage?: string | null,
): Promise<{ prescriptionId: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  if (targetLanguage) form.append("targetLanguage", targetLanguage);

  const response = await fetch("/api/v1/prescriptions", {
    method: "POST",
    body: form,
  });

  return parseJson(response);
}

export async function getPrescription(id: string): Promise<PrescriptionRecord> {
  const response = await fetch(`/api/v1/prescriptions/${id}`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJson(response);
}

export async function translatePrescription(
  id: string,
  targetLanguage: string,
): Promise<{
  prescriptionId: string;
  targetLanguage: string;
  translatedData: TranslatedPresentation;
  cached: boolean;
}> {
  const response = await fetch(`/api/v1/prescriptions/${id}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetLanguage }),
  });
  const data = await parseJson<{
    prescriptionId: string;
    targetLanguage: string;
    translatedData: unknown;
    cached: boolean;
  }>(response);

  if (!isTranslatedPresentation(data.translatedData)) {
    throw new PrescriptionApiError(
      "Translation did not return a complete prescription presentation.",
      "INVALID_TRANSLATION",
      502,
    );
  }

  return {
    ...data,
    translatedData: data.translatedData,
  };
}

export async function askPrescriptionQuestion(
  id: string,
  question: string,
  options?: {
    language?: string | null;
    history?: Array<{ role: "user" | "assistant"; text: string }>;
    includeAudio?: boolean;
  },
): Promise<QuestionAnswer> {
  const response = await fetch(`/api/v1/prescriptions/${id}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      language: options?.language ?? undefined,
      history: options?.history ?? [],
      includeAudio: options?.includeAudio === true,
    }),
  });
  return parseJson(response);
}

export function prescriptionFileUrl(id: string): string {
  return `/api/v1/prescriptions/${id}/file`;
}

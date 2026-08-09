import type { CanonicalPrescription } from "@/types/prescription";

export function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasPatient(data: CanonicalPrescription | null | undefined): boolean {
  if (!data?.patient) return false;
  return hasText(data.patient.name) || hasText(data.patient.age) || hasText(data.patient.gender);
}

export function hasDoctor(data: CanonicalPrescription | null | undefined): boolean {
  if (!data?.doctor) return false;
  return (
    hasText(data.doctor.name) ||
    hasText(data.doctor.registrationNumber) ||
    hasText(data.doctor.clinic)
  );
}

export function presentVitals(
  data: CanonicalPrescription | null | undefined,
): { key: string; label: string; value: string }[] {
  if (!data?.vitals) return [];
  const entries: { key: string; label: string; value: string }[] = [];
  const map: [keyof CanonicalPrescription["vitals"], string][] = [
    ["bloodPressure", "Blood pressure"],
    ["bloodSugar", "Blood sugar"],
    ["temperature", "Temperature"],
    ["pulse", "Pulse"],
    ["weight", "Weight"],
    ["spo2", "SpO2"],
  ];
  for (const [key, label] of map) {
    const value = data.vitals[key];
    if (hasText(value)) entries.push({ key, label, value });
  }
  return entries;
}

export function presentMedications(data: CanonicalPrescription | null | undefined) {
  return (data?.medications ?? []).filter((m) => hasText(m.name));
}

export function presentTests(data: CanonicalPrescription | null | undefined) {
  return (data?.tests ?? []).filter((t) => hasText(t.name));
}

export function hasFollowUp(data: CanonicalPrescription | null | undefined): boolean {
  if (!data?.followUp) return false;
  return hasText(data.followUp.date) || hasText(data.followUp.instructions);
}

export function buildSuggestedQuestions(
  data: CanonicalPrescription | null | undefined,
): string[] {
  if (!data) return [];
  const suggestions: string[] = [];
  const vitals = presentVitals(data);
  if (vitals.some((v) => v.key === "bloodPressure")) suggestions.push("What was my BP?");
  if (vitals.some((v) => v.key === "bloodSugar")) suggestions.push("What was my sugar level?");
  const meds = presentMedications(data);
  if (meds.length > 0) {
    suggestions.push("What medicines were prescribed?");
    if (meds.some((m) => hasText(m.timing) || hasText(m.dose) || hasText(m.frequency))) {
      suggestions.push("When should I take my medicine?");
    }
    if (meds.some((m) => hasText(m.duration))) {
      suggestions.push("How many days should I take this?");
    }
  }
  if (presentTests(data).length > 0) suggestions.push("What tests were ordered?");
  if (hasFollowUp(data)) suggestions.push("When is my follow-up?");
  return suggestions.slice(0, 5);
}

export function statusLabel(status: string): string {
  switch (status) {
    case "CREATED":
    case "UPLOADING":
      return "Uploading…";
    case "DIGITISING":
      return "Reading your prescription…";
    case "EXTRACTING":
      return "Understanding the details…";
    case "TRANSLATING":
      return "Translating…";
    case "PROCESSING":
      return "Processing…";
    case "COMPLETED":
      return "Ready";
    case "PARTIALLY_COMPLETED":
      return "Partially ready — please verify against the original";
    case "FAILED":
      return "Could not process";
    default:
      return status;
  }
}

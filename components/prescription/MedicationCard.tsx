"use client";

import { Pill } from "@phosphor-icons/react";

import { ConfidenceBadge } from "@/components/prescription/ConfidenceBadge";
import { hasText } from "@/lib/prescriptions/display";
import type { MedicationInfo } from "@/types/prescription";

export function MedicationCard({ medication }: { medication: MedicationInfo }) {
  const title = [medication.name, medication.strength].filter(hasText).join(" ");
  const dosage = medication.dose || medication.frequency;
  const rows: { label: string; value: string }[] = [];
  if (hasText(dosage)) rows.push({ label: "Dosage", value: dosage });
  if (hasText(medication.duration)) rows.push({ label: "Duration", value: medication.duration });
  if (hasText(medication.timing)) rows.push({ label: "Timing", value: medication.timing });
  if (hasText(medication.form)) rows.push({ label: "Form", value: medication.form });
  if (hasText(medication.instructions)) {
    rows.push({ label: "Notes", value: medication.instructions });
  }

  return (
    <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent"
          >
            <Pill size={16} weight="duotone" />
          </span>
          <div className="min-w-0">
            <h4 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h4>
            {medication.verificationRequired ? (
              <p className="mt-1 text-xs text-ink-mute">
                This field may need verification against the original prescription.
              </p>
            ) : null}
          </div>
        </div>
        <ConfidenceBadge needsVerification={medication.verificationRequired} />
      </div>

      {rows.length > 0 ? (
        <dl className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-[11px] font-medium tracking-wide text-ink-mute uppercase">
                {row.label}
              </dt>
              <dd className="mt-0.5 text-sm text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

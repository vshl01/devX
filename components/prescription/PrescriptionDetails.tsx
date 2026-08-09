"use client";

import {
  CalendarBlank,
  FirstAidKit,
  Flask,
  SpinnerGap,
  Stethoscope,
  User,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { MedicationCard } from "@/components/prescription/MedicationCard";
import {
  hasDoctor,
  hasFollowUp,
  hasPatient,
  hasText,
  presentMedications,
  presentTests,
  presentVitals,
} from "@/lib/prescriptions/display";
import type { CanonicalPrescription } from "@/types/prescription";

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-ink-mute uppercase">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-ink-mute uppercase">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-medium text-ink">{value}</dd>
    </div>
  );
}

export function PrescriptionDetails({
  data,
  translating,
  emptyMessage,
}: {
  data: CanonicalPrescription | null;
  translating?: boolean;
  emptyMessage?: string;
}) {
  if (!data) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-line bg-sunken/40 px-6 py-12 text-center">
        <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
          {emptyMessage ??
            "Upload a prescription to see the structured understanding here."}
        </p>
      </div>
    );
  }

  const vitals = presentVitals(data);
  const medications = presentMedications(data);
  const tests = presentTests(data);
  const diagnosis = (data.diagnosis ?? []).filter(hasText);
  const instructions = (data.additionalInstructions ?? []).filter(hasText);
  const showPatient = hasPatient(data);
  const showDoctor = hasDoctor(data);
  const showFollowUp = hasFollowUp(data);

  const hasAnything =
    showPatient ||
    showDoctor ||
    hasText(data.date) ||
    vitals.length > 0 ||
    medications.length > 0 ||
    tests.length > 0 ||
    diagnosis.length > 0 ||
    showFollowUp ||
    instructions.length > 0;

  if (!hasAnything) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-line bg-sunken/40 px-6 py-12 text-center">
        <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
          We could not extract structured fields from this prescription. Please verify against the
          original document.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-7">
      {translating ? (
        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-surface/70 pt-16 backdrop-blur-[2px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm text-ink-soft shadow-sm ring-1 ring-line">
            <SpinnerGap size={16} className="animate-spin" aria-hidden />
            Translating…
          </span>
        </div>
      ) : null}

      {showPatient ? (
        <Section icon={<User size={16} weight="duotone" />} title="Patient">
          <dl className="grid gap-3 sm:grid-cols-3">
            {hasText(data.patient.name) ? <Field label="Name" value={data.patient.name} /> : null}
            {hasText(data.patient.age) ? <Field label="Age" value={data.patient.age} /> : null}
            {hasText(data.patient.gender) ? (
              <Field label="Gender" value={data.patient.gender} />
            ) : null}
          </dl>
        </Section>
      ) : null}

      {showDoctor ? (
        <Section icon={<Stethoscope size={16} weight="duotone" />} title="Doctor">
          <dl className="grid gap-3 sm:grid-cols-2">
            {hasText(data.doctor.name) ? <Field label="Name" value={data.doctor.name} /> : null}
            {hasText(data.doctor.registrationNumber) ? (
              <Field label="Registration" value={data.doctor.registrationNumber} />
            ) : null}
            {hasText(data.doctor.clinic) ? (
              <Field label="Clinic" value={data.doctor.clinic} />
            ) : null}
          </dl>
        </Section>
      ) : null}

      {hasText(data.date) ? (
        <Section icon={<CalendarBlank size={16} weight="duotone" />} title="Date">
          <p className="text-[15px] font-medium text-ink">{data.date}</p>
        </Section>
      ) : null}

      {vitals.length > 0 ? (
        <Section icon={<FirstAidKit size={16} weight="duotone" />} title="Vitals">
          <dl className="grid gap-3 sm:grid-cols-2">
            {vitals.map((vital) => (
              <Field key={vital.key} label={vital.label} value={vital.value} />
            ))}
          </dl>
        </Section>
      ) : null}

      {medications.length > 0 ? (
        <Section icon={<FirstAidKit size={16} weight="duotone" />} title="Medicines">
          <div className="space-y-3">
            {medications.map((med, index) => (
              <MedicationCard key={`${med.name}-${index}`} medication={med} />
            ))}
          </div>
        </Section>
      ) : null}

      {tests.length > 0 ? (
        <Section icon={<Flask size={16} weight="duotone" />} title="Tests">
          <ul className="space-y-2">
            {tests.map((test, index) => (
              <li
                key={`${test.name}-${index}`}
                className="rounded-lg border border-line bg-surface px-4 py-3 text-sm shadow-sm"
              >
                <p className="font-medium text-ink">{test.name}</p>
                {hasText(test.instructions) ? (
                  <p className="mt-1 text-ink-soft">{test.instructions}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {diagnosis.length > 0 ? (
        <Section icon={<Stethoscope size={16} weight="duotone" />} title="Diagnosis">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {diagnosis.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {showFollowUp ? (
        <Section icon={<CalendarBlank size={16} weight="duotone" />} title="Follow-up">
          <dl className="grid gap-3">
            {hasText(data.followUp.date) ? (
              <Field label="Date" value={data.followUp.date} />
            ) : null}
            {hasText(data.followUp.instructions) ? (
              <Field label="Instructions" value={data.followUp.instructions} />
            ) : null}
          </dl>
        </Section>
      ) : null}

      {instructions.length > 0 ? (
        <Section icon={<FirstAidKit size={16} weight="duotone" />} title="Additional instructions">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {instructions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

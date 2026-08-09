"use client";

import {
  CalendarBlank,
  FirstAidKit,
  Flask,
  Pill,
  SpinnerGap,
  Stethoscope,
  User,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { ConfidenceBadge } from "@/components/prescription/ConfidenceBadge";
import type { TranslatedPresentation, TranslationSection } from "@/types/prescription";

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

function sectionIcon(icon: string | undefined) {
  switch (icon) {
    case "user":
      return <User size={16} weight="duotone" />;
    case "stethoscope":
      return <Stethoscope size={16} weight="duotone" />;
    case "calendar":
      return <CalendarBlank size={16} weight="duotone" />;
    case "flask":
      return <Flask size={16} weight="duotone" />;
    case "pill":
      return <Pill size={16} weight="duotone" />;
    default:
      return <FirstAidKit size={16} weight="duotone" />;
  }
}

function fieldsColumns(section: TranslationSection) {
  if (section.id === "patient") return "sm:grid-cols-3";
  if (section.id === "vitals" || section.id === "doctor") return "sm:grid-cols-2";
  return "sm:grid-cols-2";
}

/**
 * Renders Sarvam-translated structured presentation with the SAME layout
 * as the Original AI Understanding panel (sections + medicine cards).
 */
export function PrescriptionPresentation({
  data,
  translating,
  emptyMessage,
}: {
  data: TranslatedPresentation | null;
  translating?: boolean;
  emptyMessage?: string;
}) {
  if (!data?.sections?.length) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-line bg-sunken/40 px-6 py-12 text-center">
        <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
          {emptyMessage ?? "Translated prescription will appear here."}
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

      {data.sections.map((section) => {
        if (section.type === "fields") {
          const fields = section.fields ?? [];
          // Date section with a single date field — match Original single-line style
          if (section.id === "date" && fields.length === 1) {
            return (
              <Section key={section.id} icon={sectionIcon(section.icon)} title={section.title}>
                <p className="text-[15px] font-medium text-ink">{fields[0].value}</p>
              </Section>
            );
          }
          return (
            <Section key={section.id} icon={sectionIcon(section.icon)} title={section.title}>
              <dl className={`grid gap-3 ${fieldsColumns(section)}`}>
                {fields.map((f) => (
                  <Field key={`${section.id}-${f.key}-${f.label}`} label={f.label} value={f.value} />
                ))}
              </dl>
            </Section>
          );
        }

        if (section.type === "cards") {
          return (
            <Section key={section.id} icon={sectionIcon(section.icon)} title={section.title}>
              <div className="space-y-3">
                {(section.cards ?? []).map((card, index) => (
                  <article
                    key={`${section.id}-${card.title}-${index}`}
                    className="rounded-lg border border-line bg-surface p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          aria-hidden
                          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent"
                        >
                          {section.id === "tests" ? (
                            <Flask size={16} weight="duotone" />
                          ) : (
                            <Pill size={16} weight="duotone" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-[15px] font-semibold tracking-tight text-ink">
                            {card.title}
                          </h4>
                          {card.verificationRequired ? (
                            <p className="mt-1 text-xs text-ink-mute">
                              This field may need verification against the original prescription.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {section.id === "medications" ? (
                        <ConfidenceBadge needsVerification={card.verificationRequired} />
                      ) : null}
                    </div>

                    {(card.fields?.length ?? 0) > 0 ? (
                      <dl className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
                        {card.fields!.map((row) => (
                          <div key={`${card.title}-${row.key}-${row.label}`}>
                            <dt className="text-[11px] font-medium tracking-wide text-ink-mute uppercase">
                              {row.label}
                            </dt>
                            <dd className="mt-0.5 text-sm text-ink">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </article>
                ))}
              </div>
            </Section>
          );
        }

        if (section.type === "list") {
          return (
            <Section key={section.id} icon={sectionIcon(section.icon)} title={section.title}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
                {(section.items ?? []).map((item, index) => (
                  <li key={`${section.id}-${index}`}>{item.value}</li>
                ))}
              </ul>
            </Section>
          );
        }

        return null;
      })}
    </div>
  );
}

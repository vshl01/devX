"use client";

import { CaretDown, Translate } from "@phosphor-icons/react";
import { useId } from "react";

import { LANGUAGES, type TranslatableLanguage } from "@/lib/languages";

/**
 * Native select on purpose: it is keyboard and screen-reader correct on every
 * platform, and on mobile it opens the system picker.
 */
export function LanguageSelect({
  value,
  onChange,
  disabled,
}: {
  value: TranslatableLanguage;
  onChange: (next: TranslatableLanguage) => void;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <div className="relative flex items-center">
      <label htmlFor={id} className="sr-only">
        Report language
      </label>
      <Translate
        size={15}
        aria-hidden
        className="pointer-events-none absolute left-2.5 text-ink-mute"
      />
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as TranslatableLanguage)}
        className="h-8 appearance-none rounded-full border border-line-strong bg-surface pr-7 pl-8 text-[13px] text-ink transition-colors duration-150 hover:border-accent-line disabled:opacity-55"
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.native}
          </option>
        ))}
      </select>
      <CaretDown
        size={12}
        aria-hidden
        className="pointer-events-none absolute right-2.5 text-ink-mute"
      />
    </div>
  );
}

"use client";

import { CaretDown } from "@phosphor-icons/react";

import { PRIMARY_LANGUAGES } from "@/types/prescription";
import { cn } from "@/lib/utils";

export function LanguageSelector({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("relative inline-flex items-center gap-2 text-sm", className)}>
      <span className="text-ink-soft">Understand in</span>
      <span className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 appearance-none rounded-full border border-line-strong bg-surface py-1.5 pr-9 pl-3 text-sm font-medium text-ink outline-none transition-[border-color,background-color] duration-150 ease-out-soft hover:border-accent-line disabled:opacity-55"
          aria-label="Select language"
        >
          {PRIMARY_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
        <CaretDown
          size={14}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-mute"
        />
      </span>
    </label>
  );
}

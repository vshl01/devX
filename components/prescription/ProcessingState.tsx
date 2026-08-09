"use client";

import { Info, SpinnerGap } from "@phosphor-icons/react";

export function ProcessingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-line bg-sunken/40 px-6 py-12 text-center">
      <SpinnerGap size={28} className="animate-spin text-accent" aria-hidden />
      <p className="mt-4 text-sm font-medium text-ink">{message}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink-mute">
        This usually takes a short while. Keep this page open.
      </p>
    </div>
  );
}

export function SafetyNote() {
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-mute">
      <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
      This assistant explains information found in your prescription. It does not provide medical
      diagnosis or treatment advice.
    </p>
  );
}

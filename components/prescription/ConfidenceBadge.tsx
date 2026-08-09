"use client";

import { CheckCircle, Warning } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export function ConfidenceBadge({
  needsVerification,
  className,
}: {
  needsVerification?: boolean;
  className?: string;
}) {
  if (needsVerification) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger",
          className,
        )}
      >
        <Warning size={12} weight="fill" aria-hidden />
        Needs verification
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent",
        className,
      )}
    >
      <CheckCircle size={12} weight="fill" aria-hidden />
      High confidence
    </span>
  );
}

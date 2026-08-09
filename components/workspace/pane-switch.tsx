"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

import { cn } from "@/lib/utils";

export type LeftView = "chat" | "document";

const VIEWS: Array<{ id: LeftView; label: string }> = [
  { id: "chat", label: "Chat" },
  { id: "document", label: "Document" },
];

/** Segmented control with the selection sliding between the two views. */
export function PaneSwitch({
  value,
  onChange,
  badge,
}: {
  value: LeftView;
  onChange: (next: LeftView) => void;
  /** Marks Chat when something new arrived while Document was open. */
  badge?: boolean;
}) {
  const layoutId = useId();
  const reduced = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label="Left pane view"
      className="relative flex rounded-full border border-line bg-sunken p-0.5"
    >
      {VIEWS.map((view) => {
        const active = value === view.id;
        return (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(view.id)}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
              active ? "text-ink" : "text-ink-soft hover:text-ink",
            )}
          >
            {active ? (
              <motion.span
                layoutId={reduced ? undefined : `${layoutId}-pill`}
                className="absolute inset-0 rounded-full bg-surface shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative flex items-center gap-1.5">
              {view.label}
              {view.id === "chat" && badge && !active ? (
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

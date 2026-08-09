"use client";

import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { transition } from "@/lib/motion";
import type { ReplyState } from "@/types/composer";

/** The coach's answer, streamed under the composer. */
export function ReplyPanel({
  reply,
  onRetry,
  onDismiss,
}: {
  reply: ReplyState;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {reply.status !== "idle" ? (
        <motion.div
          key="reply"
          initial={reduced ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -6 }}
          transition={transition.base}
          className="mt-3 rounded-lg border border-line bg-surface p-5 text-left shadow-sm"
        >
          {reply.status === "error" ? (
            <div className="flex items-start gap-3">
              <WarningCircle size={18} className="mt-0.5 shrink-0 text-danger" />
              <div className="flex-1">
                <p className="text-[14px] text-ink">{reply.message}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
                >
                  <ArrowClockwise size={14} />
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <>
              <p
                aria-live="polite"
                className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink"
              >
                {reply.text}
                {reply.status === "streaming" ? (
                  <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-accent align-baseline motion-safe:animate-pulse" />
                ) : null}
              </p>

              {reply.status === "done" ? (
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-3">
                  <p className="text-xs text-ink-mute">
                    Educational only. It does not replace your doctor.
                  </p>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="shrink-0 text-xs font-medium text-ink-soft hover:text-ink"
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

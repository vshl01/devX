"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import type { VoiceStatus } from "@/types/conversation";

/**
 * Amplitude meter for the voice bar. The bar heights are written straight to
 * the DOM from a single rAF loop, so a 60fps signal never touches React.
 *
 * Under reduced motion it collapses to a static indicator, as required.
 */

const BAR_COUNT = 28;

/** Bell-shaped weighting so the middle of the meter carries the most travel. */
const WEIGHTS = Array.from({ length: BAR_COUNT }, (_, index) => {
  const t = index / (BAR_COUNT - 1);
  return 0.25 + 0.75 * Math.sin(Math.PI * t) ** 1.4;
});

export function VoiceWaveform({
  levelRef,
  status,
  className,
}: {
  levelRef: React.RefObject<number>;
  status: VoiceStatus;
  className?: string;
}) {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const reduced = useReducedMotion();

  const live = status === "listening" || status === "speaking" || status === "thinking";

  useEffect(() => {
    if (reduced || !live) return;

    let frame = 0;
    let phase = 0;

    const tick = () => {
      phase += 0.14;

      // Listening follows the microphone. Thinking and speaking are the agent's
      // own turn, so they run a calm synthetic pulse rather than fake input.
      const driven = status === "listening";
      const level = driven ? (levelRef.current ?? 0) : status === "speaking" ? 0.62 : 0.22;

      for (let index = 0; index < BAR_COUNT; index += 1) {
        const bar = barsRef.current[index];
        if (!bar) continue;
        const sway = 0.5 + 0.5 * Math.sin(phase + index * 0.42);
        const scale = 0.1 + level * WEIGHTS[index] * (0.45 + sway * 0.75);
        bar.style.transform = `scaleY(${Math.min(1, scale).toFixed(3)})`;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [levelRef, live, reduced, status]);

  const tone =
    status === "speaking"
      ? "bg-accent"
      : status === "listening"
        ? "bg-live"
        : status === "thinking"
          ? "bg-ink-mute"
          : "bg-line-strong";

  return (
    <span
      aria-hidden
      className={cn("flex h-7 flex-1 items-center justify-center gap-[3px]", className)}
    >
      {WEIGHTS.map((weight, index) => (
        <span
          key={index}
          ref={(node) => {
            barsRef.current[index] = node;
          }}
          className={cn("w-[3px] rounded-full transition-colors duration-200", tone)}
          style={{
            height: `${Math.round(10 + weight * 18)}px`,
            transformOrigin: "center",
            transform: reduced || !live ? "scaleY(0.16)" : "scaleY(0.1)",
            opacity: live ? 1 : 0.4,
          }}
        />
      ))}
    </span>
  );
}

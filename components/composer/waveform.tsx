"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const BARS = [0.55, 0.85, 1, 0.75, 0.45];

/**
 * Live level meter for the mic. Reads the smoothed RMS from a ref and writes
 * straight to the DOM, so a 60fps signal never re-renders React.
 */
export function Waveform({
  levelRef,
  active,
  className,
}: {
  levelRef: React.RefObject<number>;
  active: boolean;
  className?: string;
}) {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active || reduced) return;

    let frame = 0;
    let phase = 0;

    const tick = () => {
      phase += 0.18;
      const level = levelRef.current ?? 0;

      barsRef.current.forEach((bar, index) => {
        if (!bar) return;
        // A small travelling wave keeps the meter alive during quiet passages
        // without pretending there is signal when there is none.
        const sway = 0.5 + 0.5 * Math.sin(phase + index * 0.9);
        const scale = 0.18 + level * BARS[index] * (0.55 + sway * 0.65);
        bar.style.transform = `scaleY(${Math.min(1, scale).toFixed(3)})`;
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, levelRef, reduced]);

  return (
    <span
      aria-hidden
      className={cn("flex h-5 items-center gap-[3px]", className)}
    >
      {BARS.map((height, index) => (
        <span
          key={index}
          ref={(node) => {
            barsRef.current[index] = node;
          }}
          className="w-[3px] rounded-full bg-live transition-opacity duration-150"
          style={{
            height: `${Math.round(height * 20)}px`,
            transformOrigin: "center",
            transform: reduced ? `scaleY(0.55)` : "scaleY(0.2)",
            opacity: active ? 1 : 0.35,
          }}
        />
      ))}
    </span>
  );
}

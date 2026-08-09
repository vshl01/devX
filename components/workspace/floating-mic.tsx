"use client";

import { Microphone, MicrophoneSlash, Stop } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { VoiceStatus } from "@/types/conversation";

/**
 * One-tap entry into the conversation, reachable from anywhere in the left
 * pane. Pressing it opens the microphone and starts listening in the same
 * gesture: no mode to select, no second confirmation.
 *
 * The halo tracks real microphone amplitude, written straight to the DOM so the
 * signal never re-renders React.
 */

const LABEL: Record<VoiceStatus, string> = {
  idle: "Start talking",
  listening: "Listening, tap to stop",
  thinking: "Thinking",
  speaking: "Speaking, tap to interrupt",
  denied: "Microphone blocked",
  unsupported: "Voice unavailable",
  error: "Voice error",
};

export function FloatingMic({
  status,
  micOn,
  levelRef,
  onActivate,
  onStop,
  className,
}: {
  status: VoiceStatus;
  micOn: boolean;
  levelRef: React.RefObject<number>;
  onActivate: () => void;
  onStop: () => void;
  className?: string;
}) {
  const haloRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  const listening = status === "listening";
  const speaking = status === "speaking";
  const thinking = status === "thinking";
  const blocked = status === "denied" || status === "unsupported";

  useEffect(() => {
    if (!listening || reduced) {
      if (haloRef.current) haloRef.current.style.transform = "scale(1)";
      return;
    }

    let frame = 0;
    const tick = () => {
      const halo = haloRef.current;
      if (halo) {
        const level = levelRef.current ?? 0;
        halo.style.transform = `scale(${(1 + Math.min(1, level) * 0.5).toFixed(3)})`;
        halo.style.opacity = `${(0.18 + Math.min(1, level) * 0.35).toFixed(3)}`;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [levelRef, listening, reduced]);

  return (
    <motion.button
      type="button"
      onClick={() => (listening ? onStop() : onActivate())}
      disabled={blocked}
      aria-label={LABEL[status]}
      title={LABEL[status]}
      aria-pressed={micOn}
      initial={reduced ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={reduced ? undefined : { scale: 0.93 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "group absolute right-5 bottom-5 z-30 flex size-14 items-center justify-center rounded-full",
        "shadow-lg transition-[background-color,color] duration-200 ease-out-soft",
        "disabled:cursor-not-allowed disabled:opacity-55",
        listening
          ? "bg-live text-white"
          : speaking
            ? "bg-accent text-on-accent"
            : "glass text-ink hover:text-accent",
        className,
      )}
    >
      {/* Amplitude halo. Sits behind the button and never takes pointer events. */}
      <span
        ref={haloRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full",
          listening ? "bg-live" : "bg-accent",
        )}
        style={{ opacity: 0, transformOrigin: "center", willChange: "transform" }}
      />

      {/* A slow ring while the agent thinks, so the button is never dead. */}
      {thinking && !reduced ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-accent"
          animate={{ scale: [1, 1.25], opacity: [0.45, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      ) : null}

      <span className="relative flex items-center justify-center">
        {blocked ? (
          <MicrophoneSlash size={23} />
        ) : speaking ? (
          <Stop size={20} weight="fill" />
        ) : (
          <Microphone size={23} weight={listening ? "fill" : "regular"} />
        )}
      </span>
    </motion.button>
  );
}

"use client";

import {
  ArrowUp,
  Microphone,
  MicrophoneSlash,
  Play,
  SpeakerHigh,
  Stop,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { transition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { VoiceStatus } from "@/types/conversation";

import { VoiceWaveform } from "./voice-waveform";

/** Press longer than this is push-to-talk rather than a toggle. */
const HOLD_THRESHOLD_MS = 300;

/** One label and one tone per state, so the state is never ambiguous. */
const STATE_COPY: Record<VoiceStatus, { label: string; tone: string }> = {
  idle: { label: "Tap to talk", tone: "text-ink-mute" },
  listening: { label: "Listening", tone: "text-live" },
  thinking: { label: "Thinking", tone: "text-ink-soft" },
  speaking: { label: "Speaking", tone: "text-accent" },
  denied: { label: "Microphone blocked", tone: "text-danger" },
  unsupported: { label: "Voice unavailable", tone: "text-danger" },
  error: { label: "Voice error", tone: "text-danger" },
};

export interface VoiceBarProps {
  status: VoiceStatus;
  micOn: boolean;
  blocked: boolean;
  speechAvailable: boolean;
  levelRef: React.RefObject<number>;
  onToggleMic: () => void;
  onInterrupt: () => void;
  onSend: (text: string) => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onUnblock: () => void;
}

export function VoiceBar({
  status,
  micOn,
  blocked,
  speechAvailable,
  levelRef,
  onToggleMic,
  onInterrupt,
  onSend,
  onHoldStart,
  onHoldEnd,
  onUnblock,
}: VoiceBarProps) {
  const [draft, setDraft] = useState("");
  const reduced = useReducedMotion();

  const copy = STATE_COPY[status];
  const blockedMic = status === "denied" || status === "unsupported";
  const busy = status === "speaking" || status === "thinking";

  // A tap toggles the mic; holding is push-to-talk. Without this split the
  // pointer handlers and the click handler would fight over the same press.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);
  const pointerHandledRef = useRef(false);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const pressStart = () => {
    if (blockedMic) return;
    heldRef.current = false;
    pointerHandledRef.current = true;
    holdTimer.current = setTimeout(() => {
      heldRef.current = true;
      onHoldStart();
    }, HOLD_THRESHOLD_MS);
  };

  const pressEnd = () => {
    if (blockedMic) return;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (heldRef.current) {
      heldRef.current = false;
      onHoldEnd();
    } else {
      onToggleMic();
    }
  };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSend(text);
  };

  return (
    <div className="glass-nav border-t border-line px-3 py-3 sm:px-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            // Keyboard activation never sees pointer events, so it falls
            // through to a plain toggle.
            onClick={() => {
              if (pointerHandledRef.current) {
                pointerHandledRef.current = false;
                return;
              }
              if (!blockedMic) onToggleMic();
            }}
            onPointerDown={pressStart}
            onPointerUp={pressEnd}
            onPointerCancel={pressEnd}
            onPointerLeave={() => {
              if (heldRef.current) pressEnd();
            }}
            disabled={blockedMic}
            aria-pressed={micOn}
            aria-label={
              blockedMic
                ? "Microphone unavailable"
                : micOn
                  ? "Turn the microphone off"
                  : "Turn the microphone on, or hold to talk"
            }
            className={cn(
              "relative flex size-12 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,transform] duration-150 ease-out-soft active:scale-95 disabled:opacity-50",
              micOn
                ? "border-transparent bg-live text-white"
                : "border-line-strong bg-surface text-ink-soft hover:border-accent-line hover:bg-accent-soft hover:text-accent",
            )}
          >
            {/* A single ring pulse reads as "the mic is open" without a loop of noise. */}
            {micOn && !reduced ? (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full border border-live"
                animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
            ) : null}
            {blockedMic ? <MicrophoneSlash size={21} /> : <Microphone size={21} weight={micOn ? "fill" : "regular"} />}
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <VoiceWaveform levelRef={levelRef} status={status} />
            <motion.span
              key={copy.label}
              initial={reduced ? false : { opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transition.fast}
              className={cn("text-center text-[11px] font-medium tracking-wide", copy.tone)}
              aria-live="polite"
            >
              {copy.label}
            </motion.span>
          </div>

          {blocked ? (
            <button
              type="button"
              onClick={onUnblock}
              aria-label="Play the reply"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-colors duration-150 hover:bg-accent-hover"
            >
              <Play size={18} weight="fill" />
            </button>
          ) : busy ? (
            <button
              type="button"
              onClick={onInterrupt}
              aria-label="Stop the assistant"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors duration-150 hover:border-accent-line hover:text-accent"
            >
              <Stop size={17} weight="fill" />
            </button>
          ) : (
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-mute/50"
            >
              <SpeakerHigh size={18} />
            </span>
          )}
        </div>

        {/* Voice is never the only way in. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-1 pl-3.5"
        >
          <label htmlFor="voice-fallback" className="sr-only">
            Type a question instead
          </label>
          <input
            id="voice-fallback"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={speechAvailable ? "Or type a question" : "Type a question"}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-ink outline-none placeholder:text-ink-mute"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send question"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full transition-[background-color,opacity] duration-150",
              draft.trim()
                ? "bg-accent text-on-accent hover:bg-accent-hover"
                : "cursor-not-allowed bg-line text-ink-mute",
            )}
          >
            <ArrowUp size={16} weight="bold" />
          </button>
        </form>

        <p className="text-center text-[11px] text-ink-mute">
          Explains your document. Not a diagnosis, and not a substitute for your doctor.
        </p>
      </div>
    </div>
  );
}

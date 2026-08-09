"use client";

import { Microphone, MicrophoneSlash, Stop } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { RecorderState } from "@/types/composer";

import { Waveform } from "./waveform";

export function MicButton({
  state,
  levelRef,
  onToggle,
}: {
  state: RecorderState;
  levelRef: React.RefObject<number>;
  onToggle: () => void;
}) {
  const recording = state === "recording";
  const blocked = state === "denied" || state === "unsupported";
  const busy = state === "requesting";

  const label = recording
    ? "Stop recording"
    : blocked
      ? "Microphone unavailable"
      : "Record your question";

  return (
    <div className="flex items-center gap-2">
      {recording ? (
        <span className="flex items-center gap-2 rounded-full bg-danger-soft py-1 pr-3 pl-2.5">
          <Waveform levelRef={levelRef} active />
          <span className="text-xs font-medium text-live tabular-nums">Listening</span>
        </span>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        disabled={blocked || busy}
        aria-pressed={recording}
        aria-label={label}
        title={label}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,transform] duration-150 ease-out-soft active:scale-[0.96] disabled:opacity-50",
          recording
            ? "border-transparent bg-live text-white"
            : "border-line-strong bg-surface text-ink-soft hover:border-accent-line hover:bg-accent-soft hover:text-accent",
        )}
      >
        {recording ? (
          <Stop size={17} weight="fill" />
        ) : blocked ? (
          <MicrophoneSlash size={19} />
        ) : (
          <Microphone size={19} />
        )}
      </button>
    </div>
  );
}

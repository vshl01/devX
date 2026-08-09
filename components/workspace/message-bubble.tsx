"use client";

import { Check, Copy, Quotes, SpeakerHigh, Warning } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { ChatMessage, TurnConfidence } from "@/types/conversation";

/**
 * One turn. Confidence is carried visually, not just in words: anything the
 * agent could not read cleanly, or that did not come from the document at all,
 * is tinted and tagged so it cannot be mistaken for a reading of the report.
 */

const CONFIDENCE_STYLE: Record<
  TurnConfidence,
  { bubble: string; tag: string | null; tagClass: string }
> = {
  grounded: {
    bubble: "border-line bg-surface text-ink",
    tag: null,
    tagClass: "",
  },
  unclear_source: {
    bubble: "border-transparent bg-danger-soft text-ink",
    tag: "Unclear scan",
    tagClass: "text-danger",
  },
  outside_document: {
    bubble: "border-dashed border-line-strong bg-sunken text-ink",
    tag: "Not from your report",
    tagClass: "text-ink-soft",
  },
};

function clockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const isUser = message.role === "user";
  const style = CONFIDENCE_STYLE[message.confidence];

  const replay = () => {
    if (!message.audioUrl) return;
    if (replaying) {
      audioRef.current?.pause();
      setReplaying(false);
      return;
    }
    const audio = new Audio(message.audioUrl);
    audioRef.current = audio;
    audio.onended = () => setReplaying(false);
    audio.onerror = () => setReplaying(false);
    setReplaying(true);
    void audio.play().catch(() => setReplaying(false));
  };

  return (
    <div className={cn("group flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-lg border px-3.5 py-2.5 text-[15px] leading-relaxed",
          isUser ? "border-transparent bg-accent text-on-accent" : style.bubble,
        )}
      >
        {!isUser && style.tag ? (
          <span
            className={cn(
              "mb-1.5 flex items-center gap-1.5 text-[11px] font-medium",
              style.tagClass,
            )}
          >
            <Warning size={12} weight="fill" aria-hidden />
            {style.tag}
          </span>
        ) : null}

        <p className="whitespace-pre-wrap">
          {message.text}
          {message.pending && !message.text ? (
            <span className="inline-flex gap-1 align-middle" aria-label="Thinking">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1.5 rounded-full bg-ink-mute motion-safe:animate-pulse"
                  style={{ animationDelay: `${dot * 140}ms` }}
                />
              ))}
            </span>
          ) : null}
        </p>

        {!isUser && message.refs.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2">
            {message.refs.map((ref) => (
              <li
                key={ref}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent"
              >
                <Quotes size={10} weight="fill" aria-hidden />
                {ref}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-center gap-2 px-1 text-[11px] text-ink-mute opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        <time dateTime={message.createdAt}>{clockTime(message.createdAt)}</time>

        {!isUser && message.audioUrl ? (
          <button
            type="button"
            onClick={replay}
            aria-label={replaying ? "Stop playback" : "Play this reply again"}
            className={cn(
              "rounded-full p-1 transition-colors duration-150 hover:text-ink",
              replaying && "text-accent",
            )}
          >
            <SpeakerHigh size={13} weight={replaying ? "fill" : "regular"} />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(message.text).then(() => setCopied(true));
          }}
          aria-label={copied ? "Copied" : "Copy this message"}
          className="rounded-full p-1 transition-colors duration-150 hover:text-ink"
        >
          {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}

"use client";

import { ArrowDown, Microphone, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { transition } from "@/lib/motion";
import type { ChatMessage, VoiceStatus } from "@/types/conversation";

import { MessageBubble } from "./message-bubble";

/** How close to the bottom still counts as "following the conversation". */
const STICK_THRESHOLD_PX = 96;

export function ChatPane({
  messages,
  interim,
  status,
  error,
  onDismissError,
}: {
  messages: ChatMessage[];
  interim: string;
  status: VoiceStatus;
  error: string | null;
  onDismissError: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const reduced = useReducedMotion();

  const onScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    setPinned(distance <= STICK_THRESHOLD_PX);
  }, []);

  // Follow the newest turn, unless the reader has scrolled back to look.
  useEffect(() => {
    if (!pinned) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
  }, [interim, messages, pinned, reduced]);

  const jumpToLatest = () => {
    setPinned(true);
    endRef.current?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
  };

  const empty = messages.length === 0 && !interim;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5"
      >
        {empty ? (
          <EmptyState status={status} />
        ) : (
          <div
            className="flex flex-col gap-4"
            role="log"
            aria-live="polite"
            aria-label="Conversation transcript"
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* The live turn, shown while it is still being transcribed. */}
            <AnimatePresence>
              {interim ? (
                <motion.div
                  key="interim"
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0 }}
                  transition={transition.fast}
                  className="flex justify-end"
                >
                  <p className="max-w-[88%] rounded-lg border border-dashed border-accent-line bg-accent-soft px-3.5 py-2.5 text-[15px] leading-relaxed text-ink">
                    {interim}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <AnimatePresence>
        {!pinned ? (
          <motion.button
            type="button"
            onClick={jumpToLatest}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 6 }}
            transition={transition.base}
            className="glass absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium text-ink"
          >
            <ArrowDown size={13} weight="bold" />
            Jump to latest
          </motion.button>
        ) : null}
      </AnimatePresence>

      {error ? (
        <div className="flex items-start gap-2 border-t border-line bg-danger-soft px-4 py-2.5">
          <WarningCircle size={15} className="mt-0.5 shrink-0 text-danger" />
          <p className="flex-1 text-[13px] text-ink">{error}</p>
          <button
            type="button"
            onClick={onDismissError}
            className="shrink-0 text-[12px] font-medium text-ink-soft hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ status }: { status: VoiceStatus }) {
  const waiting = status === "thinking";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-full border border-line bg-sunken text-ink-mute"
      >
        <Microphone size={20} />
      </span>
      <p className="text-[15px] font-medium text-ink">
        {waiting ? "Reading your document" : "Talk it through"}
      </p>
      <p className="max-w-xs text-[13px] leading-relaxed text-ink-soft">
        {waiting
          ? "The assistant is about to open with what stands out."
          : "Tap the microphone and ask about anything in the report. You can interrupt at any time."}
      </p>
    </div>
  );
}

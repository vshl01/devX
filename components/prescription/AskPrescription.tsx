"use client";

import {
  ArrowUp,
  Info,
  Microphone,
  SpeakerHigh,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { MicButton } from "@/components/composer/mic-button";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { askPrescriptionQuestion, PrescriptionApiError } from "@/lib/prescriptions/api-client";
import { buildSuggestedQuestions } from "@/lib/prescriptions/display";
import { EASE_OUT_SOFT } from "@/lib/motion";
import type { CanonicalPrescription } from "@/types/prescription";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  found?: boolean;
  reason?: string | null;
  source?: { field: string; type?: string } | null;
  audioUrl?: string | null;
};

export function AskPrescription({
  prescriptionId,
  data,
  disabled,
  language = "en-IN",
}: {
  prescriptionId: string | null;
  data: CanonicalPrescription | null;
  disabled?: boolean;
  language?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "listening" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const audioUrlsRef = useRef<string[]>([]);
  const reduced = useReducedMotion();
  const titleId = useId();
  const suggestions = buildSuggestedQuestions(data);

  const cleanupAudioUrls = useCallback(() => {
    for (const url of audioUrlsRef.current) URL.revokeObjectURL(url);
    audioUrlsRef.current = [];
  }, []);

  useEffect(() => () => cleanupAudioUrls(), [cleanupAudioUrls]);

  const ask = useCallback(
    async (question: string, withAudio = false) => {
      const trimmed = question.trim();
      if (!trimmed || !prescriptionId || busy) return;

      setError(null);
      setBusy(true);
      setPhase("processing");
      setOpen(true);
      setInput("");

      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);

      try {
        const result = await askPrescriptionQuestion(prescriptionId, trimmed, {
          language,
          history,
          includeAudio: withAudio,
        });

        let audioUrl: string | null = null;
        if (result.audio?.base64) {
          const binary = Uint8Array.from(atob(result.audio.base64), (c) => c.charCodeAt(0));
          const blob = new Blob([binary], { type: result.audio.mimeType || "audio/wav" });
          audioUrl = URL.createObjectURL(blob);
          audioUrlsRef.current.push(audioUrl);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: result.answer,
            found: result.found,
            reason: result.reason,
            source: result.source ?? null,
            audioUrl,
          },
        ]);

        if (audioUrl) {
          const audio = new Audio(audioUrl);
          void audio.play().catch(() => {});
        }
      } catch (cause) {
        const message =
          cause instanceof PrescriptionApiError
            ? cause.message
            : "We couldn't process your question. Please try again.";
        setError(message);
      } finally {
        setBusy(false);
        setPhase("idle");
      }
    },
    [busy, language, messages, prescriptionId],
  );

  const recorder = useAudioRecorder({
    languageCode: language.startsWith("en") ? "unknown" : (language as never),
    onTranscript: (text) => {
      setPhase("processing");
      void ask(text, true);
    },
    onEmptyResult: () => {
      setPhase("idle");
      setError("We did not catch that. Please try again.");
    },
  });

  useEffect(() => {
    if (recorder.state === "recording") setPhase("listening");
  }, [recorder.state]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy, open]);

  const launcherDisabled = disabled || !prescriptionId;

  return (
    <>
      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Ask Your Prescription
            </h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              Ask anything written in your prescription — in your language.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MicButton
              state={launcherDisabled ? "unsupported" : recorder.state}
              levelRef={recorder.levelRef}
              onToggle={() => {
                if (launcherDisabled) return;
                setOpen(true);
                setPhase(recorder.state === "recording" ? "idle" : "listening");
                recorder.toggle();
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={launcherDisabled}
              onClick={() => setOpen(true)}
            >
              Open chat
            </Button>
          </div>
        </div>

        {phase === "listening" ? (
          <p className="mt-3 text-sm font-medium text-live">Listening…</p>
        ) : null}

        {!launcherDisabled && suggestions.length > 0 && messages.length === 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void ask(q)}
                className="rounded-full border border-line bg-sunken px-3 py-1.5 text-xs text-ink-soft transition-[background-color,border-color,color] duration-150 ease-out-soft hover:border-accent-line hover:bg-accent-soft hover:text-accent"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(12_18_17_/0.35)] p-0 sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: EASE_OUT_SOFT }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="flex h-[min(720px,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-lg sm:h-[min(640px,90vh)] sm:rounded-xl"
              initial={reduced ? false : { y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduced ? undefined : { y: 16, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT_SOFT }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <h2 id={titleId} className="text-sm font-semibold text-ink">
                    Ask Your Prescription
                  </h2>
                  <p className="text-xs text-ink-mute">
                    Answers only from your prescription · multilingual
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-8 items-center justify-center rounded-full text-ink-soft hover:bg-sunken hover:text-ink"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </header>

              <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {messages.length === 0 && !busy ? (
                  <div className="space-y-4">
                    <p className="text-sm text-ink-soft">
                      Ask about vitals, medicines, dosage, timing, or follow-up written on this
                      prescription — in English or an Indian language.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => void ask(q)}
                          className="rounded-full border border-line bg-sunken px-3 py-1.5 text-xs text-ink-soft hover:border-accent-line hover:bg-accent-soft hover:text-accent"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[92%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                      message.role === "user"
                        ? "ml-auto bg-accent text-on-accent"
                        : message.found === false
                          ? "border border-line bg-sunken text-ink"
                          : "bg-sunken text-ink",
                    )}
                  >
                    {message.role === "assistant" && message.found === false ? (
                      <p className="mb-1.5 inline-flex items-center gap-1 text-[11px] font-medium tracking-wide text-ink-mute uppercase">
                        <Info size={12} aria-hidden />{" "}
                        {message.reason === "OUT_OF_SCOPE"
                          ? "Not in prescription"
                          : "Not found in prescription"}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    {message.role === "assistant" && message.source?.field ? (
                      <p className="mt-2 text-[11px] text-ink-mute">
                        Source: Prescription · {message.source.field}
                      </p>
                    ) : null}
                    {message.role === "assistant" && message.audioUrl ? (
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-soft hover:border-accent-line hover:text-accent"
                        onClick={() => {
                          const audio = new Audio(message.audioUrl!);
                          void audio.play().catch(() => {});
                        }}
                      >
                        <SpeakerHigh size={14} aria-hidden /> Play response
                      </button>
                    ) : null}
                  </div>
                ))}

                {busy ? (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-sunken px-3 py-2 text-sm text-ink-soft">
                    <SpinnerGap size={14} className="animate-spin" aria-hidden />
                    {phase === "listening"
                      ? "Listening…"
                      : "Checking your prescription…"}
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="border-t border-line px-4 py-2 text-xs text-danger">{error}</p>
              ) : null}

              <form
                className="flex items-end gap-2 border-t border-line p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(input, false);
                }}
              >
                <MicButton
                  state={recorder.state}
                  levelRef={recorder.levelRef}
                  onToggle={() => {
                    setPhase(recorder.state === "recording" ? "idle" : "listening");
                    recorder.toggle();
                  }}
                />
                <label className="sr-only" htmlFor="ask-prescription-input">
                  Ask a question
                </label>
                <input
                  id="ask-prescription-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question…"
                  disabled={busy}
                  className="h-11 flex-1 rounded-full border border-line-strong bg-sunken px-4 text-sm text-ink outline-none placeholder:text-ink-mute focus:border-accent-line"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-[opacity,transform] duration-150 ease-out-soft enabled:hover:bg-accent-hover enabled:active:scale-[0.96] disabled:opacity-45"
                >
                  {busy ? (
                    <SpinnerGap size={18} className="animate-spin" />
                  ) : recorder.state === "recording" ? (
                    <Microphone size={18} />
                  ) : (
                    <ArrowUp size={18} weight="bold" />
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

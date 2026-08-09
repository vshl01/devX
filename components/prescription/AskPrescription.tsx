"use client";

import {
  ArrowUp,
  Info,
  Microphone,
  SpeakerHigh,
  SpinnerGap,
  Stop,
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

type VoicePhase = "idle" | "listening" | "processing" | "speaking";

export function AskPrescription({
  prescriptionId,
  data,
  disabled,
}: {
  prescriptionId: string | null;
  data: CanonicalPrescription | null;
  disabled?: boolean;
  /** Unused: answers follow the spoken/typed question language. */
  language?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const audioUrlsRef = useRef<string[]>([]);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const playbackDoneRef = useRef<(() => void) | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const phaseRef = useRef<VoicePhase>("idle");
  const askInFlightRef = useRef(false);
  const askAbortRef = useRef<AbortController | null>(null);
  const reduced = useReducedMotion();
  const titleId = useId();
  const suggestions = buildSuggestedQuestions(data);

  const processing = phase === "processing";
  const speaking = phase === "speaking";
  const listening = phase === "listening";
  const inputLocked = processing;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const finishPlayback = useCallback(() => {
    const done = playbackDoneRef.current;
    playbackDoneRef.current = null;
    playbackRef.current = null;
    setPlayingMessageId(null);
    done?.();
  }, []);

  const stopPlayback = useCallback(() => {
    const audio = playbackRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    finishPlayback();
  }, [finishPlayback]);

  const cleanupAudioUrls = useCallback(() => {
    stopPlayback();
    for (const url of audioUrlsRef.current) URL.revokeObjectURL(url);
    audioUrlsRef.current = [];
  }, [stopPlayback]);

  useEffect(() => () => cleanupAudioUrls(), [cleanupAudioUrls]);

  const playResponseAudio = useCallback(
    (audioUrl: string, messageId?: string) =>
      new Promise<void>((resolve) => {
        stopPlayback();
        const audio = new Audio(audioUrl);
        playbackRef.current = audio;
        playbackDoneRef.current = resolve;
        if (messageId) setPlayingMessageId(messageId);

        const finish = () => {
          if (playbackRef.current !== audio) return;
          finishPlayback();
        };

        audio.addEventListener("ended", finish, { once: true });
        audio.addEventListener("error", finish, { once: true });
        void audio.play().catch(() => finish());
      }),
    [finishPlayback, stopPlayback],
  );

  const stopSpeaking = useCallback(() => {
    stopPlayback();
    if (phaseRef.current === "speaking") setPhase("idle");
  }, [stopPlayback]);

  const ask = useCallback(
    async (question: string, withAudio = false) => {
      const trimmed = question.trim();
      if (!trimmed || !prescriptionId) return;
      if (askInFlightRef.current) return;
      if (phaseRef.current === "processing") return;

      // New question while TTS is playing — cut it off.
      if (phaseRef.current === "speaking") stopPlayback();

      askInFlightRef.current = true;
      askAbortRef.current?.abort();
      const abort = new AbortController();
      askAbortRef.current = abort;

      setError(null);
      setPhase("processing");
      setOpen(true);
      setInput("");

      const history = messagesRef.current.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);

      try {
        // Language is detected from the question text on the server.
        const result = await askPrescriptionQuestion(prescriptionId, trimmed, {
          language: null,
          history,
          includeAudio: withAudio,
          signal: abort.signal,
        });

        if (abort.signal.aborted) return;

        let audioUrl: string | null = null;
        if (result.audio?.base64) {
          const binary = Uint8Array.from(atob(result.audio.base64), (c) => c.charCodeAt(0));
          const blob = new Blob([binary], { type: result.audio.mimeType || "audio/wav" });
          audioUrl = URL.createObjectURL(blob);
          audioUrlsRef.current.push(audioUrl);
        }

        const assistantId = `a-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            text: result.answer,
            found: result.found,
            reason: result.reason,
            source: result.source ?? null,
            audioUrl,
          },
        ]);

        if (audioUrl && !abort.signal.aborted) {
          setPhase("speaking");
          await playResponseAudio(audioUrl, assistantId);
        }
      } catch (cause) {
        if (
          abort.signal.aborted ||
          (cause instanceof DOMException && cause.name === "AbortError") ||
          (cause instanceof Error && cause.name === "AbortError")
        ) {
          return;
        }
        const message =
          cause instanceof PrescriptionApiError
            ? cause.message
            : "We couldn't process your question. Please try again.";
        setError(message);
      } finally {
        if (askAbortRef.current === abort) askAbortRef.current = null;
        askInFlightRef.current = false;
        if (!abort.signal.aborted) {
          setPhase((current) => (current === "processing" || current === "speaking" ? "idle" : current));
        }
      }
    },
    [playResponseAudio, prescriptionId, stopPlayback],
  );

  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  }, [ask]);

  const recorder = useAudioRecorder({
    languageCode: "unknown",
    mode: "utterance",
    onTranscript: (text) => {
      if (askInFlightRef.current) return;
      if (phaseRef.current === "processing") return;
      const cleaned = text.trim();
      if (!cleaned) return;
      setPhase("processing");
      void askRef.current(cleaned, true);
    },
    onEmptyResult: () => {
      if (askInFlightRef.current) return;
      setPhase("idle");
      setError("We did not catch that. Tap the mic and try again.");
    },
  });

  const recorderStopRef = useRef(recorder.stop);
  const recorderCancelRef = useRef(recorder.cancel);
  useEffect(() => {
    recorderStopRef.current = recorder.stop;
    recorderCancelRef.current = recorder.cancel;
  }, [recorder.cancel, recorder.stop]);

  useEffect(() => {
    if (recorder.state === "recording") {
      setPhase((current) => (current === "idle" || current === "speaking" ? "listening" : current));
    }
  }, [recorder.state]);

  // Mic must stay closed while we process an answer.
  useEffect(() => {
    if (phase === "processing") {
      recorderCancelRef.current();
    }
  }, [phase]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, phase, open]);

  const cancelAsk = useCallback(() => {
    askAbortRef.current?.abort();
    askAbortRef.current = null;
    askInFlightRef.current = false;
    stopPlayback();
    setPhase("idle");
  }, [stopPlayback]);

  const closeChat = useCallback(() => {
    recorderCancelRef.current();
    cancelAsk();
    setOpen(false);
  }, [cancelAsk]);

  const toggleMic = useCallback(() => {
    if (disabled || !prescriptionId) return;

    // Interrupt TTS, then start a new question.
    if (phaseRef.current === "speaking") {
      stopSpeaking();
      setOpen(true);
      setError(null);
      setPhase("listening");
      void recorder.start();
      return;
    }

    if (phaseRef.current === "processing") return;

    setOpen(true);
    setError(null);

    if (recorder.state === "recording" || recorder.state === "requesting") {
      // Early end: flush what was said so it can be answered.
      recorder.stop();
      return;
    }

    setPhase("listening");
    void recorder.start();
  }, [disabled, prescriptionId, recorder, stopSpeaking]);

  const cancelListening = useCallback(() => {
    recorderCancelRef.current();
    setPhase("idle");
    setError(null);
  }, []);

  const replayOrStop = useCallback(
    (message: Message) => {
      if (!message.audioUrl || processing || askInFlightRef.current) return;

      if (playingMessageId === message.id && phaseRef.current === "speaking") {
        stopSpeaking();
        return;
      }

      setPhase("speaking");
      void playResponseAudio(message.audioUrl, message.id).finally(() => {
        if (!askInFlightRef.current && phaseRef.current === "speaking") {
          setPhase("idle");
        }
      });
    },
    [playResponseAudio, playingMessageId, processing, stopSpeaking],
  );

  const launcherDisabled = disabled || !prescriptionId;
  const micBlocked = processing;

  const phaseLabel =
    phase === "listening"
      ? "Listening… tap mic when you're done"
      : phase === "processing"
        ? "Checking your prescription…"
        : phase === "speaking"
          ? "Speaking answer… tap mic or Stop to interrupt"
          : null;

  return (
    <>
      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Ask Your Prescription
            </h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              Tap the mic, ask in any language. You can stop the answer anytime and ask again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(micBlocked && "pointer-events-none opacity-45")}>
              <MicButton
                state={launcherDisabled ? "unsupported" : recorder.state}
                levelRef={recorder.levelRef}
                onToggle={toggleMic}
              />
            </div>
            {speaking ? (
              <Button type="button" variant="secondary" size="sm" onClick={stopSpeaking}>
                <Stop size={14} weight="fill" className="mr-1.5" aria-hidden />
                Stop
              </Button>
            ) : null}
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

        {phaseLabel ? (
          <p
            className={cn(
              "mt-3 text-sm font-medium",
              listening ? "text-live" : "text-ink-soft",
            )}
          >
            {phaseLabel}
          </p>
        ) : null}

        {!launcherDisabled && suggestions.length > 0 && messages.length === 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                disabled={inputLocked}
                onClick={() => void ask(q, false)}
                className="rounded-full border border-line bg-sunken px-3 py-1.5 text-xs text-ink-soft transition-[background-color,border-color,color] duration-150 ease-out-soft hover:border-accent-line hover:bg-accent-soft hover:text-accent disabled:opacity-50"
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
            onClick={closeChat}
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
                    Speak or type · interrupt the answer anytime
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeChat}
                  className="flex size-8 items-center justify-center rounded-full text-ink-soft hover:bg-sunken hover:text-ink"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </header>

              <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {messages.length === 0 && phase === "idle" ? (
                  <div className="space-y-4">
                    <p className="text-sm text-ink-soft">
                      Tap the mic and ask about medicines, dosage, or vitals. Replies stay grounded
                      in your prescription and match the language you used.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={inputLocked}
                          onClick={() => void ask(q, false)}
                          className="rounded-full border border-line bg-sunken px-3 py-1.5 text-xs text-ink-soft hover:border-accent-line hover:bg-accent-soft hover:text-accent disabled:opacity-50"
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
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-soft hover:border-accent-line hover:text-accent disabled:opacity-50"
                        disabled={processing}
                        onClick={() => replayOrStop(message)}
                      >
                        {playingMessageId === message.id && speaking ? (
                          <>
                            <Stop size={14} weight="fill" aria-hidden /> Stop
                          </>
                        ) : (
                          <>
                            <SpeakerHigh size={14} aria-hidden /> Play response
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                ))}

                {phase !== "idle" ? (
                  <div className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-sunken px-3 py-2 text-sm text-ink-soft">
                    {listening ? (
                      <>
                        <span className="size-2 animate-pulse rounded-full bg-live" aria-hidden />
                        Listening… tap mic when done
                        <button
                          type="button"
                          onClick={cancelListening}
                          className="ml-1 rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink-soft hover:border-accent-line hover:text-accent"
                        >
                          Cancel
                        </button>
                      </>
                    ) : speaking ? (
                      <>
                        <SpeakerHigh size={14} className="text-accent" aria-hidden />
                        Speaking answer…
                        <button
                          type="button"
                          onClick={stopSpeaking}
                          className="ml-1 inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink-soft hover:border-danger hover:text-danger"
                        >
                          <Stop size={12} weight="fill" aria-hidden />
                          Stop
                        </button>
                      </>
                    ) : (
                      <>
                        <SpinnerGap size={14} className="animate-spin" aria-hidden />
                        Checking your prescription…
                        <button
                          type="button"
                          onClick={cancelAsk}
                          className="ml-1 rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink-soft hover:border-accent-line hover:text-accent"
                        >
                          Cancel
                        </button>
                      </>
                    )}
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
                  if (inputLocked) return;
                  if (speaking) stopSpeaking();
                  void ask(input, false);
                }}
              >
                <div className={cn(micBlocked && "pointer-events-none opacity-45")}>
                  <MicButton
                    state={recorder.state}
                    levelRef={recorder.levelRef}
                    onToggle={toggleMic}
                  />
                </div>
                <label className="sr-only" htmlFor="ask-prescription-input">
                  Ask a question
                </label>
                <input
                  id="ask-prescription-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    speaking
                      ? "Type to interrupt and ask…"
                      : processing
                        ? "Processing…"
                        : "Ask a question…"
                  }
                  disabled={inputLocked}
                  className="h-11 flex-1 rounded-full border border-line-strong bg-sunken px-4 text-sm text-ink outline-none placeholder:text-ink-mute focus:border-accent-line disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={inputLocked || !input.trim()}
                  aria-label="Send"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-[opacity,transform] duration-150 ease-out-soft enabled:hover:bg-accent-hover enabled:active:scale-[0.96] disabled:opacity-45"
                >
                  {processing ? (
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AudioQueue, SpeechChunker } from "@/lib/audio-queue";
import { META_SENTINEL_CLIENT, parseClientTurn } from "@/lib/turn-protocol";
import { canSpeakLanguage, type TranslatableLanguage } from "@/lib/languages";
import { MicCapture, MicError } from "@/lib/mic-capture";
import { createSocketTransport, type SttTransport } from "@/lib/stt-transport";
import type { ChatMessage, VoiceStatus } from "@/types/conversation";

/** Silence after Sarvam's end-of-speech signal before the agent replies. */
const ENDPOINT_MS = 900;

/**
 * Local barge-in. Sarvam's own speech signal is more accurate but round-trips,
 * and an interruption has to feel immediate, so amplitude cuts the audio first
 * and the server signal confirms it.
 */
const BARGE_LEVEL = 0.3;
const BARGE_FRAMES = 45;

function uuid(): string {
  return crypto.randomUUID();
}

export interface UseVoiceConversation {
  status: VoiceStatus;
  messages: ChatMessage[];
  /** What the user is saying right now, before the turn is submitted. */
  interim: string;
  error: string | null;
  /** Audio is ready but the browser wants a tap before it will play. */
  blocked: boolean;
  levelRef: React.RefObject<number>;
  micOn: boolean;
  speechAvailable: boolean;
  start: () => Promise<void>;
  stop: () => void;
  toggleMic: () => void;
  /** One tap: open the mic and be listening, whatever the agent was doing. */
  activate: () => Promise<void>;
  sendText: (text: string) => void;
  interrupt: () => void;
  unblock: () => void;
  holdStart: () => void;
  holdEnd: () => void;
  dismissError: () => void;
}

export interface UseVoiceConversationOptions {
  sessionId: string | null;
  language: TranslatableLanguage;
  /** True once the report exists, so the agent has something to open with. */
  ready: boolean;
  /** Transcript restored from the database. */
  initialMessages: ChatMessage[];
}

export function useVoiceConversation({
  sessionId,
  language,
  ready,
  initialMessages,
}: UseVoiceConversationOptions): UseVoiceConversation {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [micOn, setMicOn] = useState(false);

  const levelRef = useRef(0);
  const statusRef = useRef<VoiceStatus>("idle");
  const micRef = useRef<MicCapture | null>(null);
  const transportRef = useRef<SttTransport | null>(null);
  const queueRef = useRef<AudioQueue | null>(null);
  const turnRef = useRef<AbortController | null>(null);
  const ttsRef = useRef<Set<AbortController>>(new Set());
  const endpointRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef("");
  const holdingRef = useRef(false);
  const loudFramesRef = useRef(0);
  const openedRef = useRef(false);
  const speechAvailable = canSpeakLanguage(language);

  const setPhase = useCallback((next: VoiceStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  // Restored transcripts arrive after the first render. Adjusting during
  // render rather than in an effect avoids a second pass with an empty log.
  const seededRef = useRef(false);
  if (!seededRef.current && initialMessages.length > 0 && messages.length === 0) {
    seededRef.current = true;
    setMessages(initialMessages);
  }

  const ensureQueue = useCallback(() => {
    if (!queueRef.current) {
      queueRef.current = new AudioQueue({
        onSpeakingStart: () => {
          setBlocked(false);
          if (statusRef.current === "thinking") setPhase("speaking");
        },
        onDrained: () => {
          if (statusRef.current === "speaking") {
            setPhase(micRef.current ? "listening" : "idle");
          }
        },
      });
    }
    return queueRef.current;
  }, [setPhase]);

  const cancelTts = useCallback(() => {
    for (const controller of ttsRef.current) controller.abort();
    ttsRef.current.clear();
  }, []);

  /** Cuts the agent off mid-sentence and hands the floor back. */
  const interrupt = useCallback(() => {
    queueRef.current?.stop();
    cancelTts();
    turnRef.current?.abort();
    turnRef.current = null;
    loudFramesRef.current = 0;
    setPhase(micRef.current ? "listening" : "idle");
  }, [cancelTts, setPhase]);

  /* ---------------------------------------------------------------------- */
  /* Speaking                                                               */
  /* ---------------------------------------------------------------------- */

  const speak = useCallback(
    async (text: string, index: number, messageId: string) => {
      if (!speechAvailable) return;
      const queue = ensureQueue();
      queue.expect(index);

      const controller = new AbortController();
      ttsRef.current.add(controller);

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ text, language, messageId, index }),
        });

        if (!response.ok) {
          queue.abandon(index);
          return;
        }
        await queue.push(index, await response.arrayBuffer());
      } catch {
        queue.abandon(index);
      } finally {
        ttsRef.current.delete(controller);
      }
    },
    [ensureQueue, language, speechAvailable],
  );

  /* ---------------------------------------------------------------------- */
  /* One turn                                                               */
  /* ---------------------------------------------------------------------- */

  const runTurn = useCallback(
    async (question: string | null) => {
      if (!sessionId) return;

      queueRef.current?.reset();
      cancelTts();

      const controller = new AbortController();
      turnRef.current = controller;

      const assistantId = uuid();
      const userId = question ? uuid() : null;
      const now = new Date().toISOString();

      if (question && userId) {
        setMessages((current) => [
          ...current,
          {
            id: userId,
            role: "user",
            text: question,
            language,
            confidence: "grounded",
            refs: [],
            audioUrl: null,
            createdAt: now,
          },
        ]);
      }

      setInterim("");
      pendingRef.current = "";
      setPhase("thinking");

      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: "assistant",
          text: "",
          language,
          confidence: "grounded",
          refs: [],
          audioUrl: null,
          createdAt: new Date().toISOString(),
          pending: true,
        },
      ]);

      const chunker = new SpeechChunker();
      let chunkIndex = 0;
      let raw = "";
      let spoken = "";

      const emit = (chunk: string | null) => {
        if (!chunk) return;
        void speak(chunk, chunkIndex, assistantId);
        chunkIndex += 1;
      };

      try {
        const response = await fetch("/api/converse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            sessionId,
            messageId: assistantId,
            userMessageId: userId,
            text: question ?? "",
            language,
          }),
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setMessages((current) => current.filter((message) => message.id !== assistantId));
          setError(payload?.error ?? "The assistant could not answer.");
          setPhase(micRef.current ? "listening" : "idle");
          return;
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += value;

          // Everything before the trailer is speech; the trailer is data.
          const cut = raw.indexOf(META_SENTINEL_CLIENT);
          const visible = cut === -1 ? raw : raw.slice(0, cut);
          const fresh = visible.slice(spoken.length);

          if (fresh) {
            spoken = visible;
            if (cut === -1) emit(chunker.push(fresh));
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, text: visible } : message,
              ),
            );
          }
        }

        emit(chunker.flush());

        const { text, meta } = parseClientTurn(raw);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  text,
                  confidence: meta.confidence,
                  refs: meta.refs,
                  audioUrl: speechAvailable ? `/api/audio/${assistantId}` : null,
                  pending: false,
                }
              : message,
          ),
        );

        if (!speechAvailable || chunkIndex === 0) {
          setPhase(micRef.current ? "listening" : "idle");
        } else if (queueRef.current?.isSuspended) {
          // The browser is holding audio back until the page sees a gesture.
          setBlocked(true);
        }
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        setMessages((current) => current.filter((message) => message.id !== assistantId));
        setError("Lost connection to the assistant.");
        setPhase(micRef.current ? "listening" : "idle");
      } finally {
        if (turnRef.current === controller) turnRef.current = null;
      }
    },
    [cancelTts, language, sessionId, setPhase, speak, speechAvailable],
  );

  /* ---------------------------------------------------------------------- */
  /* Listening                                                              */
  /* ---------------------------------------------------------------------- */

  const submitPending = useCallback(() => {
    const text = pendingRef.current.trim();
    pendingRef.current = "";
    setInterim("");
    if (!text) return;
    void runTurn(text);
  }, [runTurn]);

  const scheduleEndpoint = useCallback(() => {
    if (endpointRef.current) clearTimeout(endpointRef.current);
    if (holdingRef.current) return;
    endpointRef.current = setTimeout(() => {
      endpointRef.current = null;
      if (pendingRef.current.trim()) submitPending();
    }, ENDPOINT_MS);
  }, [submitPending]);

  const start = useCallback(async () => {
    if (micRef.current || !sessionId) return;
    setError(null);

    let transport: SttTransport;
    try {
      const socket = createSocketTransport(language, {
        onTranscript: (text) => {
          if (statusRef.current === "speaking") interrupt();
          pendingRef.current = pendingRef.current ? `${pendingRef.current} ${text}` : text;
          setInterim(pendingRef.current);
          scheduleEndpoint();
        },
        onSpeechStart: () => {
          if (statusRef.current === "speaking") interrupt();
          if (endpointRef.current) {
            clearTimeout(endpointRef.current);
            endpointRef.current = null;
          }
        },
        onSpeechEnd: () => scheduleEndpoint(),
        onError: (message) => setError(message),
      });
      await socket.opened;
      transport = socket;
    } catch {
      setError("The live transcription channel could not open.");
      setPhase("error");
      return;
    }

    transportRef.current = transport;

    try {
      micRef.current = await MicCapture.start({
        onFrame: (pcm) => transportRef.current?.push(pcm),
        onLevel: (level) => {
          levelRef.current = level;
          if (statusRef.current !== "speaking") {
            loudFramesRef.current = 0;
            return;
          }
          loudFramesRef.current = level > BARGE_LEVEL ? loudFramesRef.current + 1 : 0;
          if (loudFramesRef.current >= BARGE_FRAMES) interrupt();
        },
      });
    } catch (cause) {
      transport.close();
      transportRef.current = null;
      const reason = cause instanceof MicError ? cause.reason : "failed";
      setPhase(reason === "denied" ? "denied" : reason === "failed" ? "error" : "unsupported");
      setError(
        reason === "denied"
          ? "Microphone access is blocked. Allow it in your browser, or type instead."
          : reason === "missing"
            ? "No microphone found. Type your question instead."
            : "The microphone could not start. Type your question instead.",
      );
      return;
    }

    setMicOn(true);
    if (statusRef.current !== "speaking" && statusRef.current !== "thinking") {
      setPhase("listening");
    }
  }, [interrupt, language, scheduleEndpoint, sessionId, setPhase]);

  const stop = useCallback(() => {
    if (endpointRef.current) {
      clearTimeout(endpointRef.current);
      endpointRef.current = null;
    }
    transportRef.current?.flush();
    transportRef.current?.close();
    transportRef.current = null;
    micRef.current?.stop();
    micRef.current = null;
    levelRef.current = 0;
    pendingRef.current = "";
    setInterim("");
    setMicOn(false);
    if (statusRef.current === "listening") setPhase("idle");
  }, [setPhase]);

  const toggleMic = useCallback(() => {
    if (micRef.current) stop();
    else void start();
  }, [start, stop]);

  /**
   * The floating control. Cuts the agent off if it is mid-sentence, opens the
   * mic if it is closed, and leaves the machine listening either way.
   */
  const activate = useCallback(async () => {
    if (statusRef.current === "speaking") interrupt();
    if (!micRef.current) {
      await start();
      return;
    }
    if (statusRef.current !== "thinking") setPhase("listening");
  }, [interrupt, setPhase, start]);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (statusRef.current === "speaking") interrupt();
      void runTurn(trimmed);
    },
    [interrupt, runTurn],
  );

  const holdStart = useCallback(() => {
    holdingRef.current = true;
    if (endpointRef.current) {
      clearTimeout(endpointRef.current);
      endpointRef.current = null;
    }
    if (statusRef.current === "speaking") interrupt();
    if (!micRef.current) void start();
  }, [interrupt, start]);

  const holdEnd = useCallback(() => {
    holdingRef.current = false;
    transportRef.current?.flush();
    // Give the last utterance time to come back before submitting.
    setTimeout(() => submitPending(), 500);
  }, [submitPending]);

  const unblock = useCallback(() => {
    setBlocked(false);
    const last = [...messages].reverse().find((message) => message.role === "assistant");
    if (last?.audioUrl) void new Audio(last.audioUrl).play().catch(() => {});
  }, [messages]);

  /* The agent opens the conversation the moment the report is written. */
  useEffect(() => {
    if (!ready || !sessionId || openedRef.current) return;
    if (messages.length > 0) {
      openedRef.current = true;
      return;
    }
    openedRef.current = true;
    // Deferred a tick: the turn writes state immediately, and that belongs
    // outside the effect body.
    const timer = setTimeout(() => void runTurn(null), 0);
    return () => clearTimeout(timer);
  }, [messages.length, ready, runTurn, sessionId]);

  useEffect(
    () => () => {
      if (endpointRef.current) clearTimeout(endpointRef.current);
      turnRef.current?.abort();
      for (const controller of ttsRef.current) controller.abort();
      transportRef.current?.close();
      micRef.current?.stop();
      queueRef.current?.close();
    },
    [],
  );

  return {
    status,
    messages,
    interim,
    error,
    blocked,
    levelRef,
    micOn,
    speechAvailable,
    start,
    stop,
    toggleMic,
    activate,
    sendText,
    interrupt,
    unblock,
    holdStart,
    holdEnd,
    dismissError: useCallback(() => setError(null), []),
  };
}

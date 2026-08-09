"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { concatFloat32, downsample, rms, toPcm16, TARGET_SAMPLE_RATE } from "@/lib/audio";
import {
  createRestTransport,
  createSocketTransport,
  type SttTransport,
} from "@/lib/stt-transport";
import type { RecorderState } from "@/types/composer";
import type { SarvamLanguageCode } from "@/types/sarvam";

/** Frames are pushed roughly every 250ms so Sarvam has steady input. */
const FRAME_MS = 250;
const FRAME_SAMPLES = (TARGET_SAMPLE_RATE * FRAME_MS) / 1000;

/** Continuous dictation (composer): short pause splits segments but keeps mic open. */
const CONTINUOUS_SILENCE_MS = 700;
/** One-shot voice chat: longer pause means "user finished speaking" → stop mic. */
const UTTERANCE_SILENCE_MS = 1100;
const MAX_UTTERANCE_MS = 12_000;
const SILENCE_RMS = 0.012;

export interface UseAudioRecorderOptions {
  languageCode?: SarvamLanguageCode;
  /**
   * `continuous` — keep listening (landing composer).
   * `utterance` — stop the mic after one spoken question (Ask Your Prescription).
   */
  mode?: "continuous" | "utterance";
  /** Called with each finalised piece of transcript, in order. */
  onTranscript: (text: string) => void;
  /** Called when a whole recording session produced no transcript at all. */
  onEmptyResult?: () => void;
}

export interface UseAudioRecorder {
  state: RecorderState;
  error: string | null;
  /** Live 0 to 1 level, read by the waveform without re-rendering React. */
  levelRef: React.RefObject<number>;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
  dismissError: () => void;
}

export function useAudioRecorder({
  languageCode = "unknown",
  mode = "continuous",
  onTranscript,
  onEmptyResult,
}: UseAudioRecorderOptions): UseAudioRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);

  const levelRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const transportRef = useRef<SttTransport | null>(null);
  const stoppingRef = useRef(false);
  const heardRef = useRef(false);
  const failedRef = useRef(false);
  const utteranceClosingRef = useRef(false);
  const modeRef = useRef(mode);

  // Kept in refs so the audio callbacks never close over stale handlers.
  const onTranscriptRef = useRef(onTranscript);
  const onEmptyResultRef = useRef(onEmptyResult);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onEmptyResultRef.current = onEmptyResult;
  }, [onEmptyResult, onTranscript]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const teardown = useCallback(() => {
    nodeRef.current?.port.close();
    nodeRef.current?.disconnect();
    nodeRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;

    levelRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    utteranceClosingRef.current = false;

    const wasCapturing = transportRef.current !== null;
    transportRef.current?.flush();
    transportRef.current?.close();
    transportRef.current = null;

    teardown();
    setState((current) => (current === "error" || current === "denied" ? current : "idle"));

    // Silence is a normal outcome, not an error. Say so rather than sit there.
    if (wasCapturing && !heardRef.current && !failedRef.current) {
      onEmptyResultRef.current?.();
    }
    stoppingRef.current = false;
  }, [teardown]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    if (state === "recording" || state === "requesting") return;

    setError(null);
    heardRef.current = false;
    failedRef.current = false;
    utteranceClosingRef.current = false;

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setError("This browser cannot record audio. Type your question instead.");
      return;
    }

    setState("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (cause) {
      const name = (cause as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
        setError("Microphone access is blocked. Allow it in your browser settings, or type instead.");
      } else if (name === "NotFoundError") {
        setState("unsupported");
        setError("No microphone found. Type your question instead.");
      } else {
        setState("error");
        setError("The microphone could not start. Try again.");
      }
      return;
    }

    streamRef.current = stream;

    const handlers = {
      onTranscript: (text: string) => {
        heardRef.current = true;
        onTranscriptRef.current(text);
      },
      onError: (message: string) => {
        failedRef.current = true;
        setError(message);
      },
    };

    // Prefer the realtime relay, fall back to segment uploads.
    let transport: SttTransport;
    try {
      const socket = createSocketTransport(languageCode, handlers);
      await socket.opened;
      transport = socket;
    } catch {
      transport = createRestTransport(languageCode, handlers);
    }
    transportRef.current = transport;

    let context: AudioContext;
    try {
      context = new AudioContext();
      await context.audioWorklet.addModule("/audio/recorder-worklet.js");
    } catch {
      transport.close();
      transportRef.current = null;
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setState("unsupported");
      setError("This browser cannot process audio. Type your question instead.");
      return;
    }

    contextRef.current = context;
    await context.resume().catch(() => {});

    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, "recorder-processor");
    nodeRef.current = node;

    let pendingFrames: Float32Array[] = [];
    let pendingSamples = 0;
    let silenceMs = 0;
    let utteranceMs = 0;
    let voiced = false;

    const silenceLimit =
      modeRef.current === "utterance" ? UTTERANCE_SILENCE_MS : CONTINUOUS_SILENCE_MS;

    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (utteranceClosingRef.current || stoppingRef.current) return;

      const chunk = downsample(event.data, context.sampleRate);
      const loudness = rms(chunk);

      // Smoothed for the meter so the bars do not flicker.
      levelRef.current = levelRef.current * 0.7 + Math.min(1, loudness * 12) * 0.3;

      pendingFrames.push(chunk);
      pendingSamples += chunk.length;

      const chunkMs = (chunk.length / TARGET_SAMPLE_RATE) * 1000;
      utteranceMs += chunkMs;
      if (loudness < SILENCE_RMS) {
        silenceMs += chunkMs;
      } else {
        silenceMs = 0;
        voiced = true;
      }

      if (pendingSamples >= FRAME_SAMPLES) {
        const merged = concatFloat32(pendingFrames);
        pendingFrames = [];
        pendingSamples = 0;
        transportRef.current?.push(toPcm16(merged));
      }

      const endOfUtterance = voiced && silenceMs >= silenceLimit;
      if (endOfUtterance || utteranceMs >= MAX_UTTERANCE_MS) {
        transportRef.current?.flush();
        silenceMs = 0;
        utteranceMs = 0;
        voiced = false;

        // Voice-chat turn: close the mic so we do not keep capturing while answering.
        if (modeRef.current === "utterance" && !utteranceClosingRef.current) {
          utteranceClosingRef.current = true;
          // Let flush travel before tearing down the transport.
          window.setTimeout(() => stopRef.current(), 120);
        }
      }
    };

    source.connect(node);
    // Keeps the graph pulling without routing the mic back to the speakers.
    const sink = context.createGain();
    sink.gain.value = 0;
    node.connect(sink).connect(context.destination);

    setState("recording");
  }, [languageCode, state]);

  const toggle = useCallback(() => {
    if (state === "recording" || state === "requesting") stop();
    else void start();
  }, [start, state, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    state,
    error,
    levelRef,
    start,
    stop,
    toggle,
    dismissError: useCallback(() => setError(null), []),
  };
}

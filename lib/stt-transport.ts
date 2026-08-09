import { encodeWav, TARGET_SAMPLE_RATE } from "@/lib/audio";
import type { SarvamLanguageCode } from "@/types/sarvam";

/**
 * Two ways to reach Sarvam speech to text, behind one interface.
 *
 * `socket`  Realtime relay over `/api/stt/ws`. Preferred: Sarvam returns a
 *           transcript per utterance while the user is still talking.
 * `rest`    Fallback for deployments without the WebSocket relay (for example
 *           a serverless host). Uploads finished segments to `/api/stt`.
 */

export interface SttTransport {
  readonly kind: "socket" | "rest";
  /** Push one block of 16 kHz mono PCM. */
  push(pcm: Int16Array): void;
  /** Mark an utterance boundary. The REST transport uploads at this point. */
  flush(): void;
  close(): void;
}

export interface SttTransportHandlers {
  onTranscript: (text: string) => void;
  onSpeechStart?: () => void;
  onError: (message: string) => void;
  /** Fires once the transport is confirmed usable. */
  onReady?: () => void;
}

interface SarvamSocketMessage {
  type?: "data" | "error" | "events" | "ready";
  data?: {
    transcript?: string;
    error?: string;
    code?: string;
    signal_type?: "START_SPEECH" | "END_SPEECH";
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function wavBase64(pcm: Int16Array): Promise<string> {
  const buffer = await encodeWav(pcm).arrayBuffer();
  return toBase64(new Uint8Array(buffer));
}

/* -------------------------------------------------------------------------- */
/* Realtime relay                                                             */
/* -------------------------------------------------------------------------- */

export function createSocketTransport(
  languageCode: SarvamLanguageCode,
  handlers: SttTransportHandlers,
): SttTransport & { opened: Promise<void> } {
  const url = new URL("/api/stt/ws", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("language-code", languageCode);

  const socket = new WebSocket(url);
  let settled = false;
  let closed = false;

  const opened = new Promise<void>((resolve, reject) => {
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(reason));
    };

    socket.addEventListener("message", (event) => {
      let message: SarvamSocketMessage;
      try {
        message = JSON.parse(String(event.data)) as SarvamSocketMessage;
      } catch {
        return;
      }

      if (message.type === "ready") {
        if (!settled) {
          settled = true;
          handlers.onReady?.();
          resolve();
        }
        return;
      }

      if (message.type === "error") {
        const detail = message.data?.error ?? "The transcription service failed.";
        fail(detail);
        if (settled) handlers.onError(detail);
        return;
      }

      if (message.type === "events") {
        if (message.data?.signal_type === "START_SPEECH") handlers.onSpeechStart?.();
        return;
      }

      const transcript = message.data?.transcript?.trim();
      if (transcript) handlers.onTranscript(transcript);
    });

    socket.addEventListener("error", () => fail("Could not open the live transcription channel."));

    socket.addEventListener("close", () => {
      fail("The live transcription channel closed.");
      if (!closed && settled) handlers.onError("The live transcription channel closed.");
    });
  });

  const queue: Promise<void> = Promise.resolve();
  let tail = queue;

  return {
    kind: "socket",
    opened,
    push(pcm) {
      if (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING) return;
      // Serialised so frames reach Sarvam in capture order.
      tail = tail.then(async () => {
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(
          JSON.stringify({
            audio: {
              data: await wavBase64(pcm),
              sample_rate: String(TARGET_SAMPLE_RATE),
              encoding: "audio/wav",
            },
          }),
        );
      });
    },
    flush() {
      tail = tail.then(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "flush" }));
        }
      });
    },
    close() {
      closed = true;
      tail = tail.then(() => {
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close(1000, "done");
        }
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Segment upload fallback                                                    */
/* -------------------------------------------------------------------------- */

export function createRestTransport(
  languageCode: SarvamLanguageCode,
  handlers: SttTransportHandlers,
): SttTransport {
  let buffered: Int16Array[] = [];
  let inFlight: Promise<void> = Promise.resolve();
  let closed = false;
  const controllers = new Set<AbortController>();

  const upload = async (pcm: Int16Array) => {
    const controller = new AbortController();
    controllers.add(controller);
    try {
      const form = new FormData();
      form.append("audio", encodeWav(pcm), "segment.wav");
      form.append("languageCode", languageCode);

      const response = await fetch("/api/stt", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        transcript?: string;
        error?: string;
      };

      if (!response.ok) {
        handlers.onError(payload.error ?? "Transcription failed.");
        return;
      }
      if (payload.transcript?.trim()) handlers.onTranscript(payload.transcript.trim());
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        handlers.onError("Lost connection while transcribing.");
      }
    } finally {
      controllers.delete(controller);
    }
  };

  return {
    kind: "rest",
    push(pcm) {
      if (!closed) buffered.push(pcm);
    },
    flush() {
      if (closed || buffered.length === 0) return;
      const total = buffered.reduce((sum, part) => sum + part.length, 0);
      const merged = new Int16Array(total);
      let offset = 0;
      for (const part of buffered) {
        merged.set(part, offset);
        offset += part.length;
      }
      buffered = [];
      // Ignore anything under 300ms: it is almost always a door or a keystroke.
      if (merged.length < TARGET_SAMPLE_RATE * 0.3) return;
      inFlight = inFlight.then(() => upload(merged));
    },
    close() {
      closed = true;
      buffered = [];
      for (const controller of controllers) controller.abort();
    },
  };
}

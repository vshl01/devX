import { concatFloat32, downsample, rms, toPcm16, TARGET_SAMPLE_RATE } from "@/lib/audio";

/**
 * Microphone capture for the conversation layer.
 *
 * Deliberately separate from the landing page recorder: that one is a
 * push-to-talk dictation loop, this one runs continuously through the agent's
 * own turns so it can hear a barge-in.
 */

/** Frames are pushed roughly every 250ms so Sarvam has steady input. */
const FRAME_MS = 250;
const FRAME_SAMPLES = (TARGET_SAMPLE_RATE * FRAME_MS) / 1000;

export type MicFailure = "denied" | "missing" | "unsupported" | "failed";

export class MicError extends Error {
  readonly reason: MicFailure;

  constructor(reason: MicFailure, message: string) {
    super(message);
    this.name = "MicError";
    this.reason = reason;
  }
}

export interface MicCaptureHandlers {
  /** One 250ms block of 16 kHz mono PCM. */
  onFrame: (pcm: Int16Array) => void;
  /** Smoothed 0 to 1 amplitude, for the waveform and local barge-in. */
  onLevel: (level: number) => void;
}

export class MicCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private frames: Float32Array[] = [];
  private samples = 0;
  private level = 0;
  private stopped = false;

  private constructor(private readonly handlers: MicCaptureHandlers) {}

  static async start(handlers: MicCaptureHandlers): Promise<MicCapture> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new MicError("unsupported", "This browser cannot record audio.");
    }

    const capture = new MicCapture(handlers);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          // Cancellation matters here: the mic stays open while the agent
          // speaks, and without it the agent would interrupt itself.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (cause) {
      const name = (cause as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new MicError("denied", "Microphone access is blocked.");
      }
      if (name === "NotFoundError") {
        throw new MicError("missing", "No microphone was found.");
      }
      throw new MicError("failed", "The microphone could not start.");
    }

    capture.stream = stream;

    let context: AudioContext;
    try {
      context = new AudioContext();
      await context.audioWorklet.addModule("/audio/recorder-worklet.js");
    } catch {
      capture.stop();
      throw new MicError("unsupported", "This browser cannot process audio.");
    }

    capture.context = context;
    await context.resume().catch(() => {});

    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, "recorder-processor");
    capture.node = node;

    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (capture.stopped) return;
      capture.consume(event.data, context.sampleRate);
    };

    // A muted sink keeps the graph pulling without echoing to the speakers.
    const sink = context.createGain();
    sink.gain.value = 0;
    source.connect(node);
    node.connect(sink).connect(context.destination);

    return capture;
  }

  private consume(input: Float32Array, sampleRate: number) {
    const chunk = downsample(input, sampleRate);

    this.level = this.level * 0.7 + Math.min(1, rms(chunk) * 12) * 0.3;
    this.handlers.onLevel(this.level);

    this.frames.push(chunk);
    this.samples += chunk.length;

    if (this.samples >= FRAME_SAMPLES) {
      const merged = concatFloat32(this.frames);
      this.frames = [];
      this.samples = 0;
      this.handlers.onFrame(toPcm16(merged));
    }
  }

  stop() {
    this.stopped = true;

    if (this.node) {
      this.node.port.onmessage = null;
      this.node.port.close();
      this.node.disconnect();
      this.node = null;
    }

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    void this.context?.close().catch(() => {});
    this.context = null;

    this.frames = [];
    this.samples = 0;
    this.level = 0;
  }
}

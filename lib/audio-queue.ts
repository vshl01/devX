/**
 * Ordered, gapless playback for streamed speech.
 *
 * Synthesis of chunk N+1 runs while chunk N is still playing, so clips arrive
 * out of order. They are decoded as they land and played strictly by index,
 * scheduled on the Web Audio clock so there is no seam between them. Web Audio
 * rather than `<audio>` elements is what makes `stop()` instant, which is what
 * a barge-in needs.
 */

export interface AudioQueueHandlers {
  onSpeakingStart?: () => void;
  onDrained?: () => void;
}

export class AudioQueue {
  private context: AudioContext | null = null;
  private readonly buffers = new Map<number, AudioBuffer>();
  private readonly expected = new Set<number>();
  private source: AudioBufferSourceNode | null = null;
  private cursor = 0;
  private playing = false;
  /** Audio-clock time at which the queued tail finishes. */
  private tail = 0;
  private closed = false;

  constructor(private readonly handlers: AudioQueueHandlers = {}) {}

  private ensureContext(): AudioContext {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext();
    }
    void this.context.resume().catch(() => {});
    return this.context;
  }

  /** Declares a chunk index so the queue knows not to drain past a gap. */
  expect(index: number) {
    if (this.closed) return;
    this.expected.add(index);
  }

  /** Hands over one synthesised chunk. Decoding happens here. */
  async push(index: number, audio: ArrayBuffer) {
    if (this.closed) return;
    const context = this.ensureContext();

    let decoded: AudioBuffer;
    try {
      decoded = await context.decodeAudioData(audio);
    } catch {
      // A clip that will not decode must not stall everything behind it.
      this.expected.delete(index);
      this.drain();
      return;
    }

    if (this.closed) return;
    this.buffers.set(index, decoded);
    this.drain();
  }

  /** Marks a chunk as never arriving, so playback can move past it. */
  abandon(index: number) {
    this.expected.delete(index);
    this.buffers.delete(index);
    if (index === this.cursor) this.cursor += 1;
    this.drain();
  }

  private drain() {
    if (this.closed) return;
    const context = this.context;
    if (!context) return;

    while (this.buffers.has(this.cursor)) {
      const buffer = this.buffers.get(this.cursor)!;
      this.buffers.delete(this.cursor);
      this.expected.delete(this.cursor);
      this.cursor += 1;

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);

      const startAt = Math.max(context.currentTime, this.tail);
      source.start(startAt);
      this.tail = startAt + buffer.duration;
      this.source = source;

      if (!this.playing) {
        this.playing = true;
        this.handlers.onSpeakingStart?.();
      }

      source.onended = () => {
        if (this.closed || source !== this.source) return;
        // Nothing decoded and nothing outstanding: the turn is spoken.
        if (this.buffers.size === 0 && this.expected.size === 0) {
          this.playing = false;
          this.source = null;
          this.tail = 0;
          this.handlers.onDrained?.();
        }
      };
    }
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** True when the browser is holding audio back until a user gesture. */
  get isSuspended(): boolean {
    return this.context?.state === "suspended";
  }

  /** Cuts playback immediately and forgets everything queued. */
  stop() {
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        // Already ended.
      }
      this.source.disconnect();
      this.source = null;
    }

    this.buffers.clear();
    this.expected.clear();
    this.cursor = 0;
    this.tail = 0;

    const wasPlaying = this.playing;
    this.playing = false;
    if (wasPlaying) this.handlers.onDrained?.();
  }

  /** Resets indices for a new turn. */
  reset() {
    this.stop();
    this.closed = false;
  }

  close() {
    this.stop();
    this.closed = true;
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}

/**
 * Splits streaming model output into speakable chunks.
 *
 * The first chunk is cut as early as a clause boundary allows, because time to
 * first audio is the only latency a listener actually notices. Later chunks are
 * whole sentences, which sound better.
 */
export class SpeechChunker {
  private pending = "";
  private emitted = 0;

  private static readonly SENTENCE_END = /[.!?।॥]["')\]]?\s$/;
  private static readonly CLAUSE_END = /[,;:.!?।॥]["')\]]?\s$/;

  private static readonly FIRST_MIN = 18;
  private static readonly LATER_MIN = 40;
  /** Past this, the first chunk is cut on a word so audio can start. */
  private static readonly FIRST_FORCE_AT = 80;
  private static readonly FORCE_AT = 220;

  /** Feeds a token in, returning a chunk when one is ready to synthesise. */
  push(token: string): string | null {
    this.pending += token;
    return this.take();
  }

  private take(): string | null {
    const text = this.pending;
    const isFirst = this.emitted === 0;
    const min = isFirst ? SpeechChunker.FIRST_MIN : SpeechChunker.LATER_MIN;
    const boundary = isFirst ? SpeechChunker.CLAUSE_END : SpeechChunker.SENTENCE_END;

    if (text.length >= min && boundary.test(text)) return this.emit(text);

    const forceAt = isFirst ? SpeechChunker.FIRST_FORCE_AT : SpeechChunker.FORCE_AT;
    if (text.length >= forceAt) {
      const cut = text.lastIndexOf(" ", forceAt);
      if (cut > min) {
        const chunk = text.slice(0, cut);
        this.pending = text.slice(cut);
        this.emitted += 1;
        return chunk.trim();
      }
    }

    return null;
  }

  private emit(text: string): string {
    this.pending = "";
    this.emitted += 1;
    return text.trim();
  }

  /** Whatever is left when the model stops. */
  flush(): string | null {
    const rest = this.pending.trim();
    this.pending = "";
    if (!rest) return null;
    this.emitted += 1;
    return rest;
  }
}

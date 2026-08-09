/**
 * Audio helpers for the mic pipeline. The browser captures at its native rate
 * (usually 48 kHz); Sarvam's speech-to-text wants 16 kHz mono, so we downsample
 * and wrap the PCM in a WAV container before uploading each segment.
 */

export const TARGET_SAMPLE_RATE = 16_000;

/** Linear-interpolation resample from `inputRate` down to 16 kHz. */
export function downsample(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_SAMPLE_RATE) return input;

  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const weight = position - left;
    output[i] = input[left] * (1 - weight) + input[right] * weight;
  }

  return output;
}

/** Clamped float PCM to signed 16-bit PCM. */
export function toPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

/** Root mean square of a frame, used for the level meter and silence detection. */
export function rms(input: Float32Array): number {
  if (input.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) sum += input[i] * input[i];
  return Math.sqrt(sum / input.length);
}

/** Wraps 16-bit mono PCM in a 44-byte RIFF/WAVE header. */
export function encodeWav(pcm: Int16Array, sampleRate = TARGET_SAMPLE_RATE): Blob {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, pcm.length * 2, true);

  new Int16Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}

/** Concatenates buffered frames into one contiguous PCM block. */
export function concatFloat32(frames: Float32Array[]): Float32Array {
  const total = frames.reduce((sum, frame) => sum + frame.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const frame of frames) {
    merged.set(frame, offset);
    offset += frame.length;
  }
  return merged;
}

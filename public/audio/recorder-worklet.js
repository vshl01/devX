/**
 * Capture worklet. Runs on the audio thread, copies each 128-sample render
 * quantum to the main thread, and never touches the DOM.
 */
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      // Copy: the render quantum buffer is reused by the audio thread.
      this.port.postMessage(new Float32Array(channel));
    }
    return true;
  }
}

registerProcessor("recorder-processor", RecorderProcessor);

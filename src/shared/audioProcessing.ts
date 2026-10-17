/**
 * High-Fidelity Audio Preprocessing Chain for Open Wispr
 * 
 * Pipeline order:
 * 1. High-Pass Filter (85 Hz) - removes rumble, AC/fan hum, desk thumps
 * 2. Real Denoiser - adaptive spectral noise suppression (Off / Normal / Strong)
 * 3. Voice Activity Detection (VAD) - trims non-speech with 250ms speech safety margin
 * 4. Loudness Normalization - gentle peak/RMS scaling to -3 dB with soft limiter
 * 5. Anti-aliasing Resampler - pristine 16,000 Hz mono conversion
 * 6. 16-bit Mono PCM WAV encoder
 */

export interface AudioProcessingOptions {
  noiseReduction?: 'off' | 'normal' | 'strong';
  targetSampleRate?: number; // default 16000
  applyVad?: boolean; // default true
  applyNormalization?: boolean; // default true
}

export class AudioProcessor {
  /**
   * Applies the full audio enhancement pipeline to a Float32Array of raw audio samples.
   */
  public static processAudio(
    samples: Float32Array,
    inputSampleRate: number,
    options: AudioProcessingOptions = {}
  ): {
    processedSamples: Float32Array;
    wavBuffer: ArrayBuffer;
    hasSpeech: boolean;
    speechRatio: number;
  } {
    const noiseReduction = options.noiseReduction || 'normal';
    const targetRate = options.targetSampleRate || 16000;
    const applyVad = options.applyVad !== false;
    const applyNorm = options.applyNormalization !== false;

    if (samples.length === 0) {
      const emptyWav = this.encodeWav(new Float32Array(0), targetRate);
      return { processedSamples: new Float32Array(0), wavBuffer: emptyWav, hasSpeech: false, speechRatio: 0 };
    }

    let audio: any = new Float32Array(samples);

    // 1. High-Pass Filter (85 Hz, 2nd-order Butterworth)
    audio = this.applyHighPassFilter(audio, inputSampleRate, 85);

    // 2. Real Denoiser (Adaptive Spectral Suppression)
    if (noiseReduction !== 'off') {
      audio = this.applyDenoise(audio, inputSampleRate, noiseReduction);
    }

    // 3. Voice Activity Detection (VAD)
    let hasSpeech = true;
    let speechRatio = 1.0;
    if (applyVad) {
      const vadResult = this.applyVadTrimming(audio, inputSampleRate);
      audio = vadResult.audio;
      hasSpeech = vadResult.hasSpeech;
      speechRatio = vadResult.speechRatio;
    }

    // 4. Loudness Normalization (-3 dB peak target with soft limiter)
    if (applyNorm && audio.length > 0) {
      audio = this.normalizeLoudness(audio);
    }

    // 5. High-Quality Anti-Aliasing Resample to 16,000 Hz Mono
    const resampled = this.resample(audio, inputSampleRate, targetRate);

    // 6. Encode to standard 16-bit Mono WAV
    const wavBuffer = this.encodeWav(resampled, targetRate);

    return {
      processedSamples: resampled,
      wavBuffer,
      hasSpeech,
      speechRatio,
    };
  }

  /**
   * 2nd-order IIR Butterworth High-Pass Filter
   */
  public static applyHighPassFilter(
    samples: Float32Array,
    sampleRate: number,
    cutoffHz: number = 85
  ): Float32Array {
    const output = new Float32Array(samples.length);
    const wc = 2 * Math.PI * cutoffHz / sampleRate;
    const cos_wc = Math.cos(wc);
    const sin_wc = Math.sin(wc);
    const alpha = sin_wc / (2 * Math.SQRT2);

    const b0 = (1 + cos_wc) / 2;
    const b1 = -(1 + cos_wc);
    const b2 = (1 + cos_wc) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cos_wc;
    const a2 = 1 - alpha;

    // Normalized coefficients
    const nb0 = b0 / a0;
    const nb1 = b1 / a0;
    const nb2 = b2 / a0;
    const na1 = a1 / a0;
    const na2 = a2 / a0;

    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x0 = samples[i];
      const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
      output[i] = y0;

      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }

    return output;
  }

  /**
   * Adaptive Spectral Subtraction & Noise Gate
   */
  public static applyDenoise(
    samples: Float32Array,
    sampleRate: number,
    level: 'normal' | 'strong'
  ): Float32Array {
    const frameSize = Math.round(sampleRate * 0.02); // 20ms frame
    const hopSize = Math.round(frameSize / 2); // 50% overlap
    const numFrames = Math.floor((samples.length - frameSize) / hopSize);

    if (numFrames < 2) return samples;

    const output = new Float32Array(samples.length);
    const norm = new Float32Array(samples.length);

    // Estimate noise floor from the quietest 10% frames
    const frameEnergies: number[] = [];
    for (let f = 0; f < numFrames; f++) {
      const start = f * hopSize;
      let energy = 0;
      for (let i = 0; i < frameSize; i++) {
        const s = samples[start + i];
        energy += s * s;
      }
      frameEnergies.push(energy / frameSize);
    }

    const sortedEnergies = [...frameEnergies].sort((a, b) => a - b);
    const noiseFloorIndex = Math.max(0, Math.floor(sortedEnergies.length * 0.15));
    const noiseFloor = Math.max(1e-6, sortedEnergies[noiseFloorIndex]);

    // Suppression factor based on level
    const maxSuppression = level === 'strong' ? 0.05 : 0.22; // -26dB vs -13dB
    const threshold = noiseFloor * (level === 'strong' ? 3.5 : 2.2);

    // Apply Hann windowed processing
    const window = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
    }

    let smoothedGain = 1.0;

    for (let f = 0; f < numFrames; f++) {
      const start = f * hopSize;
      const energy = frameEnergies[f];

      // Wiener-like gain calculation
      let targetGain: number;
      if (energy <= noiseFloor) {
        targetGain = maxSuppression;
      } else if (energy < threshold) {
        const ratio = (energy - noiseFloor) / (threshold - noiseFloor);
        targetGain = maxSuppression + (1.0 - maxSuppression) * ratio;
      } else {
        targetGain = 1.0;
      }

      // Smooth gain transition to prevent musical noise artifacts
      const alpha = targetGain < smoothedGain ? 0.35 : 0.7; // Fast attack, slow release
      smoothedGain = smoothedGain * alpha + targetGain * (1 - alpha);

      for (let i = 0; i < frameSize; i++) {
        const idx = start + i;
        output[idx] += samples[idx] * window[i] * smoothedGain;
        norm[idx] += window[i];
      }
    }

    // Normalize overlapping Hann windows
    for (let i = 0; i < samples.length; i++) {
      if (norm[i] > 1e-4) {
        output[i] /= norm[i];
      } else {
        output[i] = samples[i] * maxSuppression;
      }
    }

    return output;
  }

  /**
   * Voice Activity Detection (VAD) & Leading/Trailing Margin Trimmer
   */
  public static applyVadTrimming(
    samples: Float32Array,
    sampleRate: number
  ): { audio: Float32Array; hasSpeech: boolean; speechRatio: number } {
    const frameSize = Math.round(sampleRate * 0.02); // 20ms frame
    const numFrames = Math.floor(samples.length / frameSize);

    if (numFrames < 5) {
      return { audio: samples, hasSpeech: true, speechRatio: 1.0 };
    }

    let totalEnergy = 0;
    const isSpeechFrame: boolean[] = new Array(numFrames).fill(false);

    for (let f = 0; f < numFrames; f++) {
      const start = f * frameSize;
      let energy = 0;
      let zeroCrossings = 0;

      for (let i = 0; i < frameSize; i++) {
        const s = samples[start + i];
        energy += s * s;
        if (i > 0 && ((samples[start + i] >= 0 && samples[start + i - 1] < 0) || (samples[start + i] < 0 && samples[start + i - 1] >= 0))) {
          zeroCrossings++;
        }
      }

      energy /= frameSize;
      totalEnergy += energy;

      // Speech frame criteria: energetic and non-trivially harmonic
      if (energy > 0.0006 && zeroCrossings < frameSize * 0.45) {
        isSpeechFrame[f] = true;
      }
    }

    let speechCount = 0;
    for (let f = 0; f < numFrames; f++) {
      if (isSpeechFrame[f]) speechCount++;
    }

    const speechRatio = speechCount / numFrames;

    if (speechCount === 0) {
      // No active speech detected (pure background noise/silence)
      return { audio: new Float32Array(0), hasSpeech: false, speechRatio: 0 };
    }

    // Find first and last speech frames
    let firstSpeech = 0;
    while (firstSpeech < numFrames && !isSpeechFrame[firstSpeech]) {
      firstSpeech++;
    }

    let lastSpeech = numFrames - 1;
    while (lastSpeech >= 0 && !isSpeechFrame[lastSpeech]) {
      lastSpeech--;
    }

    // Keep generous 250ms margin around speech so words/vowels are never clipped
    const marginFrames = Math.round(sampleRate * 0.25 / frameSize);
    const startFrame = Math.max(0, firstSpeech - marginFrames);
    const endFrame = Math.min(numFrames - 1, lastSpeech + marginFrames);

    const startIndex = startFrame * frameSize;
    const endIndex = Math.min(samples.length, (endFrame + 1) * frameSize);

    const trimmed = new Float32Array(samples.subarray(startIndex, endIndex));

    return {
      audio: trimmed,
      hasSpeech: true,
      speechRatio,
    };
  }

  /**
   * Gentle Loudness Normalization (-3 dB peak with soft limiter)
   */
  public static normalizeLoudness(samples: Float32Array): Float32Array {
    let peak = 0;
    let sumSquares = 0;

    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) peak = abs;
      sumSquares += abs * abs;
    }

    if (peak < 1e-4) return samples;

    const rms = Math.sqrt(sumSquares / samples.length);
    const output = new Float32Array(samples.length);

    // Target peak around 0.707 (-3 dBFS), but cap amplification factor to 4x (12 dB) to avoid boosting room noise
    const targetPeak = 0.72;
    const scale = Math.min(4.0, targetPeak / Math.max(peak, 0.08));

    for (let i = 0; i < samples.length; i++) {
      let val = samples[i] * scale;
      // Soft saturation curve if val approaches +/-1
      if (val > 0.85) {
        val = 0.85 + 0.15 * Math.tanh((val - 0.85) / 0.15);
      } else if (val < -0.85) {
        val = -0.85 + 0.15 * Math.tanh((val + 0.85) / 0.15);
      }
      output[i] = val;
    }

    return output;
  }

  /**
   * High-Quality Anti-Aliased Resampler to 16,000 Hz
   */
  public static resample(
    samples: Float32Array,
    fromRate: number,
    toRate: number = 16000
  ): Float32Array {
    if (!fromRate || fromRate === toRate || samples.length === 0) {
      return samples;
    }

    const ratio = fromRate / toRate;
    const newLength = Math.round(samples.length / ratio);
    const result = new Float32Array(newLength);

    // Pre-filtering low-pass to eliminate aliasing if downsampling
    const filtered = ratio > 1.0 ? this.applyAntiAliasingFilter(samples, fromRate, toRate / 2 * 0.92) : samples;

    // Cubic Hermite spline interpolation for smooth, distortion-free output
    for (let i = 0; i < newLength; i++) {
      const srcPos = i * ratio;
      const idx = Math.floor(srcPos);
      const frac = srcPos - idx;

      const p0 = filtered[Math.max(0, idx - 1)];
      const p1 = filtered[idx];
      const p2 = filtered[Math.min(filtered.length - 1, idx + 1)];
      const p3 = filtered[Math.min(filtered.length - 1, idx + 2)];

      // Cubic interpolation
      const c0 = p1;
      const c1 = 0.5 * (p2 - p0);
      const c2 = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
      const c3 = 0.5 * (p3 - p0) + 1.5 * (p1 - p2);

      result[i] = ((c3 * frac + c2) * frac + c1) * frac + c0;
    }

    return result;
  }

  /**
   * Low-pass filter to prevent downsampling aliasing
   */
  private static applyAntiAliasingFilter(
    samples: Float32Array,
    sampleRate: number,
    cutoffHz: number
  ): Float32Array {
    const output = new Float32Array(samples.length);
    const wc = 2 * Math.PI * cutoffHz / sampleRate;
    const cos_wc = Math.cos(wc);
    const sin_wc = Math.sin(wc);
    const alpha = sin_wc / (2 * Math.SQRT2);

    const b0 = (1 - cos_wc) / 2;
    const b1 = 1 - cos_wc;
    const b2 = (1 - cos_wc) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cos_wc;
    const a2 = 1 - alpha;

    const nb0 = b0 / a0;
    const nb1 = b1 / a0;
    const nb2 = b2 / a0;
    const na1 = a1 / a0;
    const na2 = a2 / a0;

    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x0 = samples[i];
      const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
      output[i] = y0;

      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }

    return output;
  }

  /**
   * Encodes Float32 samples into a standard 16-bit Mono PCM WAV ArrayBuffer
   */
  public static encodeWav(samples: Float32Array, sampleRate: number = 16000): ArrayBuffer {
    const totalLength = samples.length;
    const buffer = new ArrayBuffer(44 + totalLength * 2);
    const view = new DataView(buffer);

    // RIFF chunk
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + totalLength * 2, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1 mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * 2)
    view.setUint16(32, 2, true); // BlockAlign (2 bytes)
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, totalLength * 2, true);

    // PCM 16-bit samples
    let offset = 44;
    for (let i = 0; i < totalLength; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    return buffer;
  }

  private static writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}

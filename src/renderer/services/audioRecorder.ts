import { AudioProcessor, AudioProcessingOptions } from '../../shared/audioProcessing';

export interface StopResult {
  wavBuffer: ArrayBuffer;
  rawWavBuffer: ArrayBuffer;
  durationMs: number;
  hasSpeech: boolean;
  speechRatio: number;
}

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private isRecording = false;
  private isWarmedUp = false;

  private actualSampleRate = 48000;

  // Pre-roll Ring Buffer (400ms circular buffer)
  private preRollBuffer: Float32Array[] = [];
  private maxPreRollChunks = 5; // ~400ms at 4096 samples / 48kHz (approx 12 chunks = 1 sec)

  // Active recording buffer
  private activePcmChunks: Float32Array[] = [];
  private recordingStartTime = 0;

  /**
   * Initializes microphone stream in background so there is ZERO delay when hotkey is pressed.
   */
  public async initWarmup(): Promise<void> {
    if (this.isWarmedUp && this.audioContext && this.stream) {
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      // Allow the system's native hardware sample rate (44.1k, 48k, etc.) to prevent NotSupportedError
      try {
        this.audioContext = new AudioCtx();
      } catch (e) {
        this.audioContext = new AudioCtx({ sampleRate: 44100 });
      }
      this.actualSampleRate = this.audioContext.sampleRate || 44100;

      this.input = this.audioContext.createMediaStreamSource(this.stream);

      // Setup Analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.input.connect(this.analyser);

      // Setup ScriptProcessor for continuous pre-roll and recording
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.maxPreRollChunks = Math.max(3, Math.ceil((this.actualSampleRate * 0.4) / 4096)); // 400ms

      this.processor.onaudioprocess = (e) => {
        const channel = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(channel);

        if (this.isRecording) {
          this.activePcmChunks.push(copy);
        } else {
          // Keep rolling pre-roll buffer
          this.preRollBuffer.push(copy);
          if (this.preRollBuffer.length > this.maxPreRollChunks) {
            this.preRollBuffer.shift();
          }
        }
      };

      // Connect to muted GainNode to avoid speaker feedback
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0;
      this.input.connect(this.processor);
      this.processor.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      this.isWarmedUp = true;
      console.log(`[AudioRecorder] Warmed up at ${this.actualSampleRate}Hz with 400ms pre-roll`);
    } catch (err) {
      console.warn('[AudioRecorder] Warmup failed (will retry on start):', err);
      this.isWarmedUp = false;
    }
  }

  public async start(
    onWaveformData: (levels: number[], isSpeaking: boolean) => void
  ): Promise<void> {
    if (!this.isWarmedUp || !this.stream || !this.audioContext) {
      await this.initWarmup();
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // 1. Reset active buffers
    this.activePcmChunks = [];
    this.recordingStartTime = Date.now();

    // 2. Prepend the 400ms pre-roll buffer so the very first word is NEVER cut off!
    if (this.preRollBuffer.length > 0) {
      for (const chunk of this.preRollBuffer) {
        this.activePcmChunks.push(new Float32Array(chunk));
      }
    }
    this.preRollBuffer = [];
    this.isRecording = true;

    // 3. Start live waveform visualizer
    if (this.analyser) {
      const freqData = new Uint8Array(this.analyser.frequencyBinCount);
      const timeData = new Uint8Array(this.analyser.fftSize);
      let smoothedRms = 0;

      const updateMeter = () => {
        if (!this.analyser || !this.isRecording) return;

        this.analyser.getByteTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128;
          sum += norm * norm;
        }
        const rms = Math.sqrt(sum / timeData.length);
        smoothedRms = smoothedRms * 0.7 + rms * 0.3;

        this.analyser.getByteFrequencyData(freqData);
        const isSpeaking = smoothedRms > 0.02;
        const levels: number[] = [];
        const step = Math.max(1, Math.floor(freqData.length / 16));

        for (let i = 0; i < 16; i++) {
          if (!isSpeaking) {
            levels.push(0.08 + Math.sin(Date.now() / 400 + i * 0.3) * 0.02);
          } else {
            const freqVal = freqData[i * step] / 255;
            const dynamicHeight = Math.min(1.0, Math.max(0.12, freqVal * 0.7 + smoothedRms * 1.5));
            levels.push(dynamicHeight);
          }
        }

        onWaveformData(levels, isSpeaking);
        this.animFrameId = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    }
  }

  public async stop(options: AudioProcessingOptions = {}): Promise<StopResult> {
    // 1. Tail padding: wait 350ms before halting capture so final word/vowel is NEVER cut!
    await new Promise((resolve) => setTimeout(resolve, 350));

    this.isRecording = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const durationMs = Date.now() - this.recordingStartTime;
    const capturedChunks = [...this.activePcmChunks];
    this.activePcmChunks = [];

    // Flatten raw audio chunks
    let totalSamples = 0;
    for (const chunk of capturedChunks) {
      totalSamples += chunk.length;
    }

    const mergedRaw = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of capturedChunks) {
      mergedRaw.set(chunk, offset);
      offset += chunk.length;
    }

    const rawRate = this.actualSampleRate;
    const rawWavBuffer = AudioProcessor.encodeWav(mergedRaw, rawRate);

    // 2. Run state-of-the-art AudioProcessor pipeline
    // High-Pass Filter -> Spectral Denoiser -> VAD -> Loudness Normalization -> 16kHz Resample -> 16-bit WAV
    const processed = AudioProcessor.processAudio(mergedRaw, rawRate, options);

    return {
      wavBuffer: processed.wavBuffer,
      rawWavBuffer,
      durationMs,
      hasSpeech: processed.hasSpeech,
      speechRatio: processed.speechRatio,
    };
  }

  public cancel(): void {
    this.isRecording = false;
    this.activePcmChunks = [];
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public destroy(): void {
    this.cancel();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.isWarmedUp = false;
  }
}

export const audioRecorder = new AudioRecorder();

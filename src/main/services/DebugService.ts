import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface DebugSessionMeta {
  timestamp: string;
  model: string;
  language: string;
  task: string;
  contentType: string;
  audioLengthMs: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  noiseReduction: string;
  hinglishMode: boolean;
  provider: string;
}

export interface DebugResponseMeta {
  statusCode?: number;
  rawResponse?: any;
  finalTranscript: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export class DebugService {
  private static debugDir: string | null = null;

  public static getDebugDir(): string {
    if (!this.debugDir) {
      this.debugDir = path.join(app.getPath('userData'), 'openwispr-data', 'debug');
      if (!fs.existsSync(this.debugDir)) {
        fs.mkdirSync(this.debugDir, { recursive: true });
      }
    }
    return this.debugDir;
  }

  public static isDebugEnabled(debugPref?: boolean): boolean {
    return Boolean(debugPref || process.env.OPEN_WISPR_DEBUG === '1');
  }

  public static createSession(
    rawBuffer: Buffer | null,
    processedBuffer: Buffer,
    requestMeta: DebugSessionMeta
  ): string | null {
    try {
      const sessionId = `rec_${Date.now()}`;
      const sessionDir = path.join(this.getDebugDir(), sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      // 1. Save raw recorded audio (before any processing)
      if (rawBuffer && rawBuffer.length > 0) {
        fs.writeFileSync(path.join(sessionDir, 'raw_recorded_audio.wav'), rawBuffer);
      } else {
        fs.writeFileSync(path.join(sessionDir, 'raw_recorded_audio.wav'), processedBuffer);
      }

      // 2. Save processed audio (after resample/denoise/VAD) as 16 kHz mono WAV
      fs.writeFileSync(path.join(sessionDir, 'processed_16k_audio.wav'), processedBuffer);

      // 3. Save exact request metadata
      fs.writeFileSync(
        path.join(sessionDir, 'request_meta.json'),
        JSON.stringify(requestMeta, null, 2),
        'utf8'
      );

      return sessionDir;
    } catch (err) {
      console.warn('[DebugService] Failed to create debug session folder:', err);
      return null;
    }
  }

  public static completeSession(sessionDir: string | null, responseMeta: DebugResponseMeta): void {
    if (!sessionDir) return;
    try {
      // 4. Save raw API response and final text shown
      fs.writeFileSync(
        path.join(sessionDir, 'response_meta.json'),
        JSON.stringify(responseMeta, null, 2),
        'utf8'
      );
    } catch (err) {
      console.warn('[DebugService] Failed to write response metadata:', err);
    }
  }
}

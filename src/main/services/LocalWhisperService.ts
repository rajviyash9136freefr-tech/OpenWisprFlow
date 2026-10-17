import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';

export interface WhisperResult {
  text: string;
  duration?: number;
  language?: string;
  error?: string;
}

export class LocalWhisperService {
  private process: ChildProcess | null = null;
  private isReady = false;
  private pendingResolvers: Array<{
    resolve: (res: WhisperResult) => void;
    reject: (err: any) => void;
  }> = [];

  constructor() {
    this.startDaemon();
  }

  public getIsReady(): boolean {
    return this.isReady && this.process !== null && !this.process.killed;
  }

  private resolveDaemonPath(): string | null {
    const candidates = [
      path.join(process.resourcesPath || '', 'bin', 'whisper_daemon.py'),
      path.join(app.getAppPath(), 'bin', 'whisper_daemon.py'),
      path.join(process.resourcesPath || '', 'services', 'whisper_daemon.py'),
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'services', 'whisper_daemon.py'),
      path.join(__dirname, 'whisper_daemon.py'),
      path.join(app.getAppPath(), 'src', 'main', 'services', 'whisper_daemon.py'),
      path.join(process.cwd(), 'src', 'main', 'services', 'whisper_daemon.py'),
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
    return null;
  }

  private startDaemon() {
    const scriptPath = this.resolveDaemonPath();
    if (!scriptPath) {
      console.warn('[LocalWhisper] whisper_daemon.py not found on disk. Falling back to one-shot mode.');
      return;
    }

    try {
      this.process = spawn('python', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let buffer = '';

      this.process.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed === 'READY') {
            console.log('[LocalWhisper] GPU Daemon is READY and listening!');
            this.isReady = true;
            continue;
          }

          if (trimmed === 'PONG') continue;

          try {
            const parsed = JSON.parse(trimmed);
            const next = this.pendingResolvers.shift();
            if (next) {
              next.resolve(parsed);
            }
          } catch (e) {
            console.warn('[LocalWhisper] Daemon output:', trimmed);
          }
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        console.log(`[WhisperDaemon Log] ${data.toString().trim()}`);
      });

      this.process.on('close', (code) => {
        console.warn(`[LocalWhisper] Daemon closed with code ${code}.`);
        this.isReady = false;
      });
    } catch (err) {
      console.error('[LocalWhisper] Failed to spawn python daemon:', err);
    }
  }

  public async transcribeBuffer(
    audioBuffer: Buffer,
    language = 'auto',
    task: 'transcribe' | 'translate' = 'transcribe',
    prompt?: string
  ): Promise<WhisperResult> {
    const isWav = audioBuffer.length > 4 && audioBuffer.toString('utf8', 0, 4) === 'RIFF';
    const ext = isWav ? '.wav' : '.webm';
    const tempFile = path.join(os.tmpdir(), `openwispr_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
    fs.writeFileSync(tempFile, audioBuffer);

    try {
      if (this.isReady && this.process && !this.process.killed) {
        return await this.transcribeFile(tempFile, language, task, prompt);
      } else {
        return await this.transcribeDirect(tempFile, language, task, prompt);
      }
    } finally {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {}
    }
  }

  public transcribeFile(
    filePath: string,
    language = 'auto',
    task: 'transcribe' | 'translate' = 'transcribe',
    prompt?: string
  ): Promise<WhisperResult> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin || this.process.killed) {
        return this.transcribeDirect(filePath, language, task, prompt).then(resolve).catch(reject);
      }

      const timer = setTimeout(() => {
        this.transcribeDirect(filePath, language, task, prompt).then(resolve).catch(reject);
      }, 15000);

      this.pendingResolvers.push({
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      const payload = JSON.stringify({
        audioPath: filePath,
        language: language === 'universal' || language === 'auto' || language === 'mixed' || !language ? null : language,
        task,
        prompt: prompt || null,
      });

      this.process.stdin.write(payload + '\n');
    });
  }

  private transcribeDirect(
    filePath: string,
    language = 'auto',
    task: 'transcribe' | 'translate' = 'transcribe',
    prompt?: string
  ): Promise<WhisperResult> {
    return new Promise((resolve) => {
      const sanitizedPrompt = (prompt || '').replace(/'/g, "\\'");
      const pyCode = `
import whisper, torch, json, warnings
warnings.filterwarnings('ignore')
device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
m = whisper.load_model('small', device=device)
opts = {'fp16': torch.cuda.is_available(), 'temperature': 0.0, 'task': '${task}'}
lang = '${language}'
if lang and lang not in ['universal', 'auto', 'mixed', 'all']: opts['language'] = lang
p = '${sanitizedPrompt}'
if p: opts['initial_prompt'] = p
res = m.transcribe(r'${filePath}', **opts)
print(json.dumps({'text': res.get('text', '').strip()}))
`;
      const ps = spawn('python', ['-c', pyCode], { windowsHide: true });
      let out = '';
      ps.stdout?.on('data', (d) => { out += d.toString(); });
      ps.on('close', () => {
        try {
          const parsed = JSON.parse(out.trim().split('\n').pop() || '{}');
          resolve({ text: parsed.text || '' });
        } catch {
          resolve({ text: '' });
        }
      });
      ps.on('error', () => resolve({ text: '' }));
    });
  }

  public destroy() {
    if (this.process) {
      try {
        this.process.stdin?.write('EXIT\n');
        this.process.kill();
      } catch {}
      this.process = null;
    }
  }
}

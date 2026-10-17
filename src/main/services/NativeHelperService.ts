import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export class NativeHelperService {
  private process: ChildProcess | null = null;
  private onHotkeyDown?: () => void;
  private onHotkeyUp?: () => void;
  private isPressed = false;
  private isAvailable = false;
  private currentHotkey = 'Caps Lock';

  constructor(
    callbacks: { onHotkeyDown: () => void; onHotkeyUp: () => void },
    initialHotkey = 'Caps Lock'
  ) {
    this.onHotkeyDown = callbacks.onHotkeyDown;
    this.onHotkeyUp = callbacks.onHotkeyUp;
    this.currentHotkey = initialHotkey;
    this.startHelper();
  }

  private resolveHelperPath(): string | null {
    const candidates = [
      path.join(process.resourcesPath || '', 'bin', 'FlowHelper.exe'),
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'bin', 'FlowHelper.exe'),
      path.join(app.getAppPath(), 'bin', 'FlowHelper.exe'),
      path.join(__dirname, '..', '..', '..', 'bin', 'FlowHelper.exe'),
      path.join(process.cwd(), 'bin', 'FlowHelper.exe'),
    ];

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private startHelper() {
    const exePath = this.resolveHelperPath();
    if (!exePath) {
      console.warn('[NativeHelper] FlowHelper.exe binary not found. Falling back to standard shortcuts.');
      this.isAvailable = false;
      return;
    }

    try {
      console.log(`[NativeHelper] Spawning FlowHelper.exe with mode '${this.currentHotkey}' from:`, exePath);
      this.process = spawn(exePath, [this.currentHotkey], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      this.process.on('error', (err) => {
        console.warn('[NativeHelper] Process error handled:', err.message);
        this.isAvailable = false;
        this.process = null;
      });

      let buffer = '';

      this.process.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed === 'HOTKEY_DOWN') {
            if (!this.isPressed) {
              this.isPressed = true;
              this.onHotkeyDown?.();
            }
          } else if (trimmed === 'HOTKEY_UP') {
            if (this.isPressed) {
              this.isPressed = false;
              this.onHotkeyUp?.();
            }
          } else if (trimmed === 'HELPER_READY') {
            this.isAvailable = true;
            console.log(`[NativeHelper] Global keyboard hook active & configured for '${this.currentHotkey}'.`);
            this.setHotkey(this.currentHotkey);
          } else if (trimmed.startsWith('HOTKEY_CONFIGURED:')) {
            console.log(`[NativeHelper] C# hook confirmed mode: ${trimmed.substring(18)}`);
          }
        }
      });

      this.process.stderr?.on('data', (chunk: Buffer) => {
        console.warn('[NativeHelper Stderr]', chunk.toString().trim());
      });

      this.process.on('close', (code) => {
        console.log(`[NativeHelper] Helper closed with code ${code}.`);
        this.isAvailable = false;
        this.process = null;
      });
    } catch (err: any) {
      console.warn('[NativeHelper] Spawn error handled:', err.message);
      this.isAvailable = false;
      this.process = null;
    }
  }

  public setHotkey(shortcut: string) {
    this.currentHotkey = shortcut;
    if (this.process && this.process.stdin) {
      try {
        console.log(`[NativeHelper] Sending SET_HOTKEY ${shortcut} to FlowHelper...`);
        this.process.stdin.write(`SET_HOTKEY ${shortcut}\n`);
      } catch (err: any) {
        console.warn('[NativeHelper] Failed to write SET_HOTKEY:', err.message);
      }
    }
  }

  public getIsAvailable(): boolean {
    return this.isAvailable;
  }

  public paste() {
    if (this.process && this.process.stdin && this.isAvailable) {
      try {
        this.process.stdin.write('PASTE\n');
        return;
      } catch (e) {
        console.warn('[NativeHelper] Stdin write error, falling back to OS paste');
      }
    }

    this.fallbackPaste();
  }

  private fallbackPaste() {
    if (process.platform === 'darwin') {
      try {
        const osa = spawn('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down']);
        osa.on('error', () => {});
      } catch (e) {}
      return;
    }

    if (process.platform === 'linux') {
      try {
        const xdo = spawn('xdotool', ['key', '--clearmodifiers', 'ctrl+v']);
        xdo.on('error', () => {
          try {
            spawn('wtype', ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl']);
          } catch (e2) {}
        });
      } catch (e) {}
      return;
    }

    try {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Start-Sleep -Milliseconds 60; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")',
      ], { windowsHide: true });
      ps.on('error', () => {});
    } catch (e) {}
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

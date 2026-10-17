import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { BRANDING } from '../../shared/branding';

export class WindowManager {
  private hubWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private scratchpadWindow: BrowserWindow | null = null;
  private meetingWindow: BrowserWindow | null = null;
  private preloadPath: string;
  private iconPath: string;
  private isDev: boolean;
  private isQuitting: boolean = false;
  public onPositionChange?: (pos: { x: number; y: number }) => void;

  constructor() {
    this.preloadPath = path.join(app.getAppPath(), 'dist-electron/preload/index.js');
    this.iconPath = path.join(app.getAppPath(), BRANDING.iconPath);
    this.isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  }

  public setQuitting(quitting: boolean) {
    this.isQuitting = quitting;
  }

  private getAppUrl(windowName: string): string {
    if (this.isDev && process.env.VITE_DEV_SERVER_URL) {
      return `${process.env.VITE_DEV_SERVER_URL}?window=${windowName}`;
    }
    const htmlPath = path.join(app.getAppPath(), 'dist/index.html');
    return `file://${htmlPath}?window=${windowName}`;
  }

  public createHubWindow(): BrowserWindow {
    if (this.hubWindow && !this.hubWindow.isDestroyed()) {
      this.hubWindow.show();
      this.hubWindow.focus();
      return this.hubWindow;
    }

    this.hubWindow = new BrowserWindow({
      width: 1180,
      height: 780,
      minWidth: 920,
      minHeight: 620,
      title: BRANDING.hubTitle,
      backgroundColor: '#F8F8F6',
      icon: this.iconPath,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        devTools: false,
      },
    });

    this.hardenWindow(this.hubWindow);

    this.hubWindow.loadURL(this.getAppUrl('hub'));

    this.hubWindow.once('ready-to-show', () => {
      this.hubWindow?.show();
    });

    // Intercept close button: Hide to tray instead of quitting!
    this.hubWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.hubWindow?.hide();
        return false;
      }
    });

    this.hubWindow.on('closed', () => {
      this.hubWindow = null;
    });

    return this.hubWindow;
  }

  public createOverlayWindow(): BrowserWindow {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      return this.overlayWindow;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const overlayWidth = 360;
    const overlayHeight = 60;
    let x = Math.round((screenWidth - overlayWidth) / 2);
    let y = Math.round(screenHeight - overlayHeight - 36);

    this.overlayWindow = new BrowserWindow({
      x,
      y,
      width: overlayWidth,
      height: overlayHeight,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        devTools: false,
      },
    });

    this.hardenWindow(this.overlayWindow);
    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    this.overlayWindow.loadURL(this.getAppUrl('overlay'));

    this.overlayWindow.on('moved', () => {
      const pos = this.getOverlayPosition();
      if (pos && this.onPositionChange) {
        this.onPositionChange(pos);
      }
    });

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
    });

    return this.overlayWindow;
  }

  public showOverlay(state: 'recording' | 'transcribing' | 'done') {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      this.createOverlayWindow();
    }
    this.overlayWindow?.showInactive();
    this.overlayWindow?.webContents.send('overlay:state-changed', { state });
  }

  public updateOverlayWaveform(levels: number[]) {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayWindow.isVisible()) {
      this.overlayWindow.webContents.send('overlay:waveform-data', levels);
    }
  }

  public hideOverlay() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.hide();
    }
  }

  public moveOverlayBy(deltaX: number, deltaY: number) {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      const [x, y] = this.overlayWindow.getPosition();
      this.overlayWindow.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    }
  }

  public getOverlayPosition(): { x: number; y: number } | null {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      const [x, y] = this.overlayWindow.getPosition();
      return { x, y };
    }
    return null;
  }

  public setOverlayPosition(x: number, y: number) {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setPosition(Math.round(x), Math.round(y));
    }
  }

  public createScratchpadWindow(): BrowserWindow {
    if (this.scratchpadWindow && !this.scratchpadWindow.isDestroyed()) {
      this.scratchpadWindow.show();
      this.scratchpadWindow.focus();
      return this.scratchpadWindow;
    }

    this.scratchpadWindow = new BrowserWindow({
      width: 600,
      height: 520,
      minWidth: 440,
      minHeight: 380,
      title: BRANDING.scratchpadTitle,
      backgroundColor: '#F8F8F6',
      icon: this.iconPath,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: false,
      },
    });

    this.hardenWindow(this.scratchpadWindow);
    this.scratchpadWindow.loadURL(this.getAppUrl('scratchpad'));

    this.scratchpadWindow.once('ready-to-show', () => {
      this.scratchpadWindow?.show();
    });

    this.scratchpadWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.scratchpadWindow?.hide();
        return false;
      }
    });

    this.scratchpadWindow.on('closed', () => {
      this.scratchpadWindow = null;
    });

    return this.scratchpadWindow;
  }

  public createMeetingWindow(): BrowserWindow {
    if (this.meetingWindow && !this.meetingWindow.isDestroyed()) {
      this.meetingWindow.show();
      this.meetingWindow.focus();
      return this.meetingWindow;
    }

    this.meetingWindow = new BrowserWindow({
      width: 500,
      height: 400,
      minWidth: 420,
      minHeight: 320,
      title: BRANDING.meetingTitle,
      backgroundColor: '#F8F8F6',
      icon: this.iconPath,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: false,
      },
    });

    this.hardenWindow(this.meetingWindow);
    this.meetingWindow.loadURL(this.getAppUrl('meeting'));

    this.meetingWindow.once('ready-to-show', () => {
      this.meetingWindow?.show();
    });

    this.meetingWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.meetingWindow?.hide();
        return false;
      }
    });

    this.meetingWindow.on('closed', () => {
      this.meetingWindow = null;
    });

    return this.meetingWindow;
  }

  private hardenWindow(win: BrowserWindow | null) {
    if (!win) return;

    // Immediately close DevTools if opened via any backdoor
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });

    // Block keyboard inspection shortcuts at OS input event level
    win.webContents.on('before-input-event', (event, input) => {
      const isDevKey =
        input.key === 'F12' ||
        (input.control && input.shift && ['I', 'i', 'J', 'j', 'C', 'c'].includes(input.key)) ||
        (input.control && ['u', 'U'].includes(input.key));
      if (isDevKey) {
        event.preventDefault();
      }
    });

    // Deny foreign window popup / link hijack attempts
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Block any attempt to navigate away to external untrusted websites
    win.webContents.on('will-navigate', (event, navigationUrl) => {
      try {
        const parsed = new URL(navigationUrl);
        if (parsed.protocol !== 'file:' && parsed.hostname !== 'localhost') {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });
  }

  public broadcast(channel: string, ...args: any[]) {
    const windows = [this.hubWindow, this.overlayWindow, this.scratchpadWindow, this.meetingWindow];
    for (const win of windows) {
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    }
  }
}

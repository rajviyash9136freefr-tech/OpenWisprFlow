import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, clipboard, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { StorageService } from './services/StorageService';
import { TranscriptionService } from './services/TranscriptionService';
import { WindowManager } from './windows/WindowManager';
import { NativeHelperService } from './services/NativeHelperService';
import { BRANDING } from '../shared/branding';

process.on('uncaughtException', (err) => {
  console.warn('[Main UncaughtException Handled]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Main UnhandledRejection Handled]', reason);
});

process.env.FLOW_APP_DIR = app.getPath('userData');
process.env.FLOW_LOG_DIR = path.join(app.getPath('userData'), 'logs');

class OpenWisprApp {
  private storage: StorageService;
  private transcription: TranscriptionService;
  private windowManager: WindowManager;
  private nativeHelper: NativeHelperService | null = null;
  private tray: Tray | null = null;
  private isRecording = false;
  private recordingStartTime = 0;

  constructor() {
    this.storage = new StorageService();
    this.transcription = new TranscriptionService();
    this.windowManager = new WindowManager();
  }

  public async init() {
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      this.windowManager.createHubWindow();
    });

    await app.whenReady();

    // Auto-grant mic permissions
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(true);
    });
    session.defaultSession.setPermissionCheckHandler(() => true);

    this.setupTray();
    this.setupIpc();
    this.setupNativeHelper();
    this.setupShortcuts();
    this.windowManager.onPositionChange = (pos) => {
      this.storage.updatePreferences({ customWindowPosition: pos });
    };

    // Open Hub & Floating Flow Bar directly on startup with ZERO LOGIN
    this.windowManager.createHubWindow();
    this.windowManager.createOverlayWindow();

    const savedPos = this.storage.getPreferences().customWindowPosition;
    if (savedPos) {
      this.windowManager.setOverlayPosition(savedPos.x, savedPos.y);
    }

    app.on('before-quit', () => {
      this.isQuitting = true;
      this.windowManager.setQuitting(true);
    });

    app.on('window-all-closed', (e) => {
      // Prevent quitting so background dictation keeps running when window is closed/cut
      e.preventDefault();
    });

    app.on('activate', () => {
      this.windowManager.createHubWindow();
    });

    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
      this.nativeHelper?.destroy();
      this.transcription.destroy();
    });
  }

  private isQuitting = false;

  private setupNativeHelper() {
    const prefs = this.storage.getPreferences();
    this.nativeHelper = new NativeHelperService(
      {
        onHotkeyDown: () => {
          if (!this.isRecording) {
            this.startDictation();
          }
        },
        onHotkeyUp: () => {
          if (this.isRecording) {
            this.stopDictation();
          }
        },
      },
      prefs.shortcutDictation || 'Caps Lock'
    );
  }

  private setupTray() {
    try {
      const iconPath = path.join(app.getAppPath(), BRANDING.iconPath);
      const icon = fs.existsSync(iconPath)
        ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
        : nativeImage.createFromBuffer(
            Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkoBAwUqifYdQADgYGhp+M1DVgYGBYw8DA0EBLA4bxGSAmJvafWJchC9KMYoA2bsBlAD4DeDRgkMFgNIDhZAA+DRg1YDAaQGDDcRkgyYChYUBmGhhNf8w0kJoGBgBNiRw1f1L+8QAAAABJRU5ErkJggg==',
              'base64'
            )
          );

      this.tray = new Tray(icon);
      this.tray.setToolTip(BRANDING.trayTooltip);

      const contextMenu = Menu.buildFromTemplate([
        {
          label: `${BRANDING.trayDefaultAction}`,
          click: () => this.toggleDictation(),
        },
        { type: 'separator' },
        {
          label: 'Open Dashboard',
          click: () => this.windowManager.createHubWindow(),
        },
        {
          label: 'Open Scratchpad',
          click: () => this.windowManager.createScratchpadWindow(),
        },
        {
          label: 'Meeting Recorder',
          click: () => this.windowManager.createMeetingWindow(),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            this.isQuitting = true;
            this.windowManager.setQuitting(true);
            app.quit();
          },
        },
      ]);

      this.tray.setContextMenu(contextMenu);
      this.tray.on('click', () => {
        this.windowManager.createHubWindow();
      });
    } catch (err: any) {
      console.warn('[Main] Tray warning:', err.message);
    }
  }

  private setupShortcuts() {
    const prefs = this.storage.getPreferences();

    try {
      globalShortcut.register('F8', () => {
        this.toggleDictation();
      });
      globalShortcut.register('CommandOrControl+Shift+Space', () => {
        this.toggleDictation();
      });
      globalShortcut.register('CommandOrControl+Space', () => {
        this.toggleDictation();
      });
    } catch (e) {}

    try {
      globalShortcut.register(prefs.shortcutScratchpad || 'CommandOrControl+Shift+N', () => {
        this.windowManager.createScratchpadWindow();
      });
    } catch (e) {}

    try {
      globalShortcut.register(prefs.shortcutMeeting || 'CommandOrControl+Shift+M', () => {
        this.windowManager.createMeetingWindow();
      });
    } catch (e) {}
  }

  public toggleDictation() {
    if (this.isRecording) {
      this.stopDictation();
    } else {
      this.startDictation();
    }
  }

  public startDictation() {
    if (this.isRecording) return;
    this.isRecording = true;
    this.recordingStartTime = Date.now();

    this.windowManager.showOverlay('recording');
    this.windowManager.broadcast('dictation:mic-start');
    this.windowManager.broadcast('dictation:status-changed', { isRecording: true });
  }

  public stopDictation() {
    if (!this.isRecording) return;
    this.isRecording = false;

    this.windowManager.showOverlay('transcribing');
    this.windowManager.broadcast('dictation:mic-stop');
    this.windowManager.broadcast('dictation:status-changed', { isRecording: false });
  }

  public cancelDictation() {
    this.isRecording = false;
    this.windowManager.broadcast('dictation:mic-cancel');
    this.windowManager.hideOverlay();
    this.windowManager.broadcast('dictation:status-changed', { isRecording: false });
  }

  private setupIpc() {
    ipcMain.handle('dictation:process-audio', async (_event, payload: any) => {
      let audioBuffer: Buffer;
      let rawBuffer: Buffer | undefined;

      if (payload instanceof ArrayBuffer) {
        audioBuffer = Buffer.from(payload);
      } else if (payload && payload.audioBuffer) {
        audioBuffer = Buffer.from(payload.audioBuffer);
        if (payload.rawBuffer) {
          rawBuffer = Buffer.from(payload.rawBuffer);
        }
      } else if (Buffer.isBuffer(payload)) {
        audioBuffer = payload;
      } else {
        throw new Error('Invalid audio payload');
      }

      const duration = Date.now() - this.recordingStartTime;
      const prefs = this.storage.getPreferences();
      const dictionary = this.storage.getDictionary();

      try {
        console.log(`[Main] Transcribing ${audioBuffer.length} bytes of audio (raw: ${rawBuffer ? rawBuffer.length : 0} bytes)...`);
        const transcript = await this.transcription.transcribeAudio(audioBuffer, prefs, dictionary, rawBuffer);
        console.log(`[Main] Final Result: "${transcript}"`);

        if (transcript) {
          // 1. Copy text to clipboard
          clipboard.writeText(transcript);

          // 2. Automatically paste directly into active textbox
          if (this.nativeHelper) {
            this.nativeHelper.paste();
          }

          // 3. Save to History (including raw recorded audio)
          const wordCount = transcript.trim().split(/\s+/).length;
          const historyItem = this.storage.addHistory({
            text: transcript,
            durationMs: duration,
            wordCount,
            appName: 'Active App',
            audioBuffer,
          });

          // 4. Update UI
          this.windowManager.showOverlay('done');
          this.windowManager.broadcast('dictation:result', historyItem);

          setTimeout(() => {
            this.windowManager.hideOverlay();
          }, 1100);
        } else {
          const hasToken = Boolean(prefs.hfToken || prefs.groqApiKey || prefs.openaiApiKey || process.env.HF_TOKEN);
          const feedbackMsg = hasToken ? 'No speech detected' : 'Set free token in Settings';
          this.windowManager.broadcast('overlay:error-message', feedbackMsg);
          setTimeout(() => {
            this.windowManager.hideOverlay();
          }, 2000);
        }

        return transcript;
      } catch (err: any) {
        console.error('[Main] Dictation processing error:', err);
        this.windowManager.broadcast('overlay:error-message', err.message || 'Transcription error');
        setTimeout(() => {
          this.windowManager.hideOverlay();
        }, 2000);
        throw err;
      }
    });

    ipcMain.on('dictation:waveform-data', (_event, levels: number[]) => {
      this.windowManager.updateOverlayWaveform(levels);
    });

    ipcMain.on('overlay:drag-move', (_event, { deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
      this.windowManager.moveOverlayBy(deltaX, deltaY);
    });

    ipcMain.on('overlay:save-position', () => {
      const pos = this.windowManager.getOverlayPosition();
      if (pos) {
        this.storage.updatePreferences({ customWindowPosition: pos });
      }
    });

    // Zubridge state mesh
    ipcMain.handle('zubridge:get-state', async (_event, slice?: string) => {
      const fullState = {
        preferences: this.storage.getPreferences(),
        history: this.storage.getHistory(),
        dictionary: this.storage.getDictionary(),
        snippets: this.storage.getSnippets(),
        notes: this.storage.getNotes(),
        meetings: this.storage.getMeetings(),
        isRecording: this.isRecording,
      };
      return slice ? (fullState as any)[slice] : fullState;
    });

    ipcMain.handle('zubridge:dispatch', async (_event, action: any, payload?: any) => {
      const actionType = typeof action === 'string' ? action : action?.type;
      const data = typeof action === 'string' ? payload : action?.payload;

      switch (actionType) {
        case 'PREFERENCES_UPDATE': {
          const updated = this.storage.updatePreferences(data);
          if (data && data.shortcutDictation) {
            this.nativeHelper?.setHotkey(data.shortcutDictation);
          }
          return updated;
        }
        case 'NOTE_SAVE':
          return this.storage.saveNote(data);
        case 'NOTE_DELETE':
          return this.storage.deleteNote(data);
        case 'DICTIONARY_ADD':
          return this.storage.addDictionaryItem(data);
        case 'DICTIONARY_DELETE':
          return this.storage.deleteDictionaryItem(data);
        case 'SNIPPET_ADD':
          return this.storage.addSnippet(data);
        case 'SNIPPET_DELETE':
          return this.storage.deleteSnippet(data);
        case 'HISTORY_BOOKMARK':
          return this.storage.toggleBookmark(data);
        case 'HISTORY_DELETE':
          return this.storage.deleteHistory(data);
        case 'DICTATION_TOGGLE':
          this.toggleDictation();
          return this.isRecording;
        default:
          return null;
      }
    });

    ipcMain.handle('history:get-audio', async (_event, id: string) => {
      return this.storage.getAudioData(id);
    });

    ipcMain.handle('dictation:start', () => this.startDictation());
    ipcMain.handle('dictation:stop', () => this.stopDictation());
    ipcMain.handle('dictation:cancel', () => this.cancelDictation());

    ipcMain.handle('api:test-connection', async (_event, customPrefs?: any) => {
      const prefs = customPrefs || this.storage.getPreferences();
      return await this.transcription.testProviderConnection(prefs);
    });

    ipcMain.handle(
      'polish:transform',
      async (_event, args: { text: string; style: any; customPrompt?: string }) => {
        const prefs = this.storage.getPreferences();
        return await this.transcription.polishText(args.text, args.style, args.customPrompt, prefs);
      }
    );

    ipcMain.handle(
      'meeting:finish',
      async (_event, args: { title: string; transcript: string; durationMs: number }) => {
        const prefs = this.storage.getPreferences();
        const { summary, actionItems } = await this.transcription.summarizeMeeting(args.transcript, prefs);
        return this.storage.addMeeting({
          title: args.title || 'Product Design Sync',
          transcript: args.transcript,
          summary,
          actionItems,
          durationMs: args.durationMs,
        });
      }
    );

    ipcMain.handle('scratchpad:open', () => this.windowManager.createScratchpadWindow());
    ipcMain.handle('meeting:open', () => this.windowManager.createMeetingWindow());
    ipcMain.handle('hub:open', () => this.windowManager.createHubWindow());
  }
}

const appInstance = new OpenWisprApp();
appInstance.init().catch((err) => {
  console.error('[OpenWispr] Initialization error:', err);
});

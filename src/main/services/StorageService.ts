import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppPreferences, HistoryItem, DictionaryItem, SnippetItem, NoteItem, MeetingItem } from '../../shared/types';

const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'light',
  activationMode: 'ptt',
  shortcutDictation: 'Caps Lock',
  shortcutScratchpad: 'CommandOrControl+Shift+N',
  shortcutMeeting: 'CommandOrControl+Shift+M',
  microphoneId: 'default',
  language: 'auto',
  translateMode: false,
  hinglishMode: false,
  soundEffects: true,
  apiProvider: 'huggingface',
  hfToken: process.env.HF_TOKEN || '',
  hfModel: 'openai/whisper-large-v3-turbo',
  groqApiKey: '',
  openaiApiKey: '',
  noiseReduction: 'normal',
  hinglishScript: 'roman',
  debugMode: false,
  hfFallbackModels: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'],
  customWindowPosition: null,
  userName: '',
};

export class StorageService {
  private dataDir: string;
  private recordingsDir: string;
  private dataFile: string;
  private data: {
    preferences: AppPreferences;
    history: HistoryItem[];
    dictionary: DictionaryItem[];
    snippets: SnippetItem[];
    notes: NoteItem[];
    meetings: MeetingItem[];
  };

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'openwispr-data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.recordingsDir = path.join(this.dataDir, 'recordings');
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
    this.dataFile = path.join(this.dataDir, 'app-state.json');
    this.data = this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf8');
        const parsed = JSON.parse(raw);
        const prefs: AppPreferences = { ...DEFAULT_PREFERENCES, ...(parsed.preferences || {}) };
        if (!prefs.hfToken && process.env.HF_TOKEN) {
          prefs.hfToken = process.env.HF_TOKEN;
        }
        prefs.apiProvider = 'huggingface';
        return {
          preferences: prefs,
          history: parsed.history || this.getInitialHistory(),
          dictionary: parsed.dictionary || this.getInitialDictionary(),
          snippets: parsed.snippets || this.getInitialSnippets(),
          notes: parsed.notes || this.getInitialNotes(),
          meetings: parsed.meetings || [],
        };
      }
    } catch (e) {
      console.error('[StorageService] Error loading data, using defaults:', e);
    }

    return {
      preferences: DEFAULT_PREFERENCES,
      history: this.getInitialHistory(),
      dictionary: this.getInitialDictionary(),
      snippets: this.getInitialSnippets(),
      notes: this.getInitialNotes(),
      meetings: [],
    };
  }

  private save() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[StorageService] Failed to save state:', e);
    }
  }

  public getPreferences(): AppPreferences {
    return { ...this.data.preferences };
  }

  public updatePreferences(patch: Partial<AppPreferences>): AppPreferences {
    this.data.preferences = { ...this.data.preferences, ...patch };
    this.save();
    return this.getPreferences();
  }

  public getHistory(): HistoryItem[] {
    return [...this.data.history];
  }

  public addHistory(item: Omit<HistoryItem, 'id' | 'createdAt'> & { audioBuffer?: Buffer }): HistoryItem {
    const id = 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    let hasAudio = false;
    let audioDataUrl: string | undefined = undefined;

    if (item.audioBuffer && item.audioBuffer.length > 44) {
      try {
        const audioPath = path.join(this.recordingsDir, `${id}.wav`);
        fs.writeFileSync(audioPath, item.audioBuffer);
        hasAudio = true;
        audioDataUrl = 'data:audio/wav;base64,' + item.audioBuffer.toString('base64');
      } catch (err) {
        console.warn('[StorageService] Failed to write audio recording to disk:', err);
      }
    }

    const { audioBuffer, ...restItem } = item;
    const newItem: HistoryItem = {
      ...restItem,
      id,
      createdAt: new Date().toISOString(),
      isBookmarked: false,
      hasAudio,
    };

    this.data.history.unshift(newItem);
    if (this.data.history.length > 500) {
      const removed = this.data.history.pop();
      if (removed) {
        try {
          const oldFile = path.join(this.recordingsDir, `${removed.id}.wav`);
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        } catch {}
      }
    }
    this.save();

    return {
      ...newItem,
      audioDataUrl,
    };
  }

  public getAudioData(id: string): string | null {
    try {
      const filePath = path.join(this.recordingsDir, `${id}.wav`);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        return 'data:audio/wav;base64,' + buf.toString('base64');
      }
    } catch (err) {
      console.error('[StorageService] Error reading audio recording:', err);
    }
    return null;
  }

  public toggleBookmark(id: string): boolean {
    const item = this.data.history.find((h) => h.id === id);
    if (item) {
      item.isBookmarked = !item.isBookmarked;
      this.save();
      return true;
    }
    return false;
  }

  public deleteHistory(id: string): boolean {
    this.data.history = this.data.history.filter((h) => h.id !== id);
    this.save();
    try {
      const filePath = path.join(this.recordingsDir, `${id}.wav`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn('[StorageService] Failed to unlink audio recording:', err);
    }
    return true;
  }

  public getDictionary(): DictionaryItem[] {
    return [...this.data.dictionary];
  }

  public addDictionaryItem(item: Omit<DictionaryItem, 'id' | 'frequencyUsed' | 'createdAt'>): DictionaryItem {
    const newItem: DictionaryItem = {
      ...item,
      id: 'dict_' + Date.now(),
      frequencyUsed: 0,
      createdAt: new Date().toISOString(),
    };
    this.data.dictionary.unshift(newItem);
    this.save();
    return newItem;
  }

  public deleteDictionaryItem(id: string): boolean {
    this.data.dictionary = this.data.dictionary.filter((d) => d.id !== id);
    this.save();
    return true;
  }

  public getSnippets(): SnippetItem[] {
    return [...this.data.snippets];
  }

  public addSnippet(item: Omit<SnippetItem, 'id' | 'createdAt'>): SnippetItem {
    const newItem: SnippetItem = {
      ...item,
      id: 'snip_' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    this.data.snippets.unshift(newItem);
    this.save();
    return newItem;
  }

  public deleteSnippet(id: string): boolean {
    this.data.snippets = this.data.snippets.filter((s) => s.id !== id);
    this.save();
    return true;
  }

  public getNotes(): NoteItem[] {
    return [...this.data.notes];
  }

  public saveNote(note: Partial<NoteItem> & { title: string; content: string }): NoteItem {
    const now = new Date().toISOString();
    const existing = this.data.notes.find((n) => n.id === note.id);
    if (existing) {
      existing.title = note.title;
      existing.content = note.content;
      existing.updatedAt = now;
      this.save();
      return existing;
    } else {
      const newNote: NoteItem = {
        id: note.id || 'note_' + Date.now(),
        title: note.title,
        content: note.content,
        createdAt: now,
        updatedAt: now,
      };
      this.data.notes.unshift(newNote);
      this.save();
      return newNote;
    }
  }

  public deleteNote(id: string): boolean {
    this.data.notes = this.data.notes.filter((n) => n.id !== id);
    this.save();
    return true;
  }

  public getMeetings(): MeetingItem[] {
    return [...this.data.meetings];
  }

  public addMeeting(meeting: Omit<MeetingItem, 'id' | 'recordedAt'>): MeetingItem {
    const newM: MeetingItem = {
      ...meeting,
      id: 'mtg_' + Date.now(),
      recordedAt: new Date().toISOString(),
    };
    this.data.meetings.unshift(newM);
    this.save();
    return newM;
  }

  private getInitialHistory(): HistoryItem[] {
    return [];
  }

  private getInitialDictionary(): DictionaryItem[] {
    return [
      {
        id: 'dict_1',
        phrase: 'Open Wispr',
        isSnippet: false,
        category: 'Personal',
        frequencyUsed: 12,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'dict_2',
        phrase: 'btw -> by the way',
        replacement: 'by the way',
        isSnippet: false,
        category: 'Personal',
        frequencyUsed: 8,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  private getInitialSnippets(): SnippetItem[] {
    return [
      {
        id: 'snip_1',
        trigger: 'my email',
        expansion: 'hello@openwispr.ai',
        category: 'Personal',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'snip_2',
        trigger: 'rewrite prompt',
        expansion: 'Rewrite this to be more concise and professional without changing the meaning.',
        category: 'Personal',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  private getInitialNotes(): NoteItem[] {
    return [
      {
        id: 'note_1',
        title: 'Voice Notes & Ideas',
        content: '# Open Wispr Scratchpad\n\nSpeak your thoughts freely or use this scratchpad for drafts and outlines.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

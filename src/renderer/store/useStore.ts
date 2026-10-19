import { create } from 'zustand';
import { AppPreferences, HistoryItem, DictionaryItem, SnippetItem, NoteItem, MeetingItem } from '../../shared/types';

interface AppStore {
  preferences: AppPreferences;
  history: HistoryItem[];
  dictionary: DictionaryItem[];
  snippets: SnippetItem[];
  notes: NoteItem[];
  meetings: MeetingItem[];
  isRecording: boolean;
  recordingState: 'idle' | 'recording' | 'transcribing' | 'done';
  waveformData: number[];
  activeTab: 'dictation' | 'insights' | 'dictionary' | 'snippets' | 'style' | 'scratchpad';
  isSettingsOpen: boolean;
  settingsTab: 'general' | 'ai' | 'system' | 'languages';
  searchQuery: string;

  // Actions
  fetchInitialState: () => Promise<void>;
  setActiveTab: (tab: AppStore['activeTab']) => void;
  openSettings: (tab?: AppStore['settingsTab']) => void;
  closeSettings: () => void;
  setSearchQuery: (query: string) => void;
  toggleDictation: () => Promise<void>;
  setRecordingState: (state: AppStore['recordingState']) => void;
  setWaveformData: (data: number[]) => void;
  updatePreferences: (patch: Partial<AppPreferences>) => Promise<void>;
  
  // History
  toggleBookmark: (id: string) => Promise<void>;
  deleteHistory: (id: string) => Promise<void>;

  // Dictionary
  addDictionaryItem: (item: { phrase: string; replacement?: string; isSnippet: boolean; category?: 'Personal' | 'Shared with team' }) => Promise<void>;
  deleteDictionaryItem: (id: string) => Promise<void>;

  // Snippets
  addSnippet: (item: { trigger: string; expansion: string; category?: 'Personal' | 'Shared with team' }) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;

  // Notes
  saveNote: (note: { id?: string; title: string; content: string }) => Promise<NoteItem>;
  deleteNote: (id: string) => Promise<void>;

  // Transforms / Polish
  transformText: (text: string, style: 'formal' | 'casual' | 'bullet' | 'concise' | 'grammar', customPrompt?: string) => Promise<string>;
  finishMeeting: (meeting: { title: string; transcript: string; durationMs: number }) => Promise<MeetingItem>;
}

declare global {
  interface Window {
    electron?: any;
    zubridge?: any;
  }
}

export const useStore = create<AppStore>((set, get) => ({
  preferences: {
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
    apiProvider: 'groq',
    hfToken: '',
    hfModel: 'openai/whisper-large-v3-turbo',
    groqApiKey: '',
    openaiApiKey: '',
    noiseReduction: 'normal',
    hinglishScript: 'roman',
    debugMode: false,
    hfFallbackModels: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'],
    customWindowPosition: null,
    userName: '',
    hasCompletedOnboarding: false,
    smartStructuring: true,
  },
  history: [],
  dictionary: [],
  snippets: [],
  notes: [],
  meetings: [],
  isRecording: false,
  recordingState: 'idle',
  waveformData: Array(16).fill(0.08),
  activeTab: 'dictation',
  isSettingsOpen: false,
  settingsTab: 'general',
  searchQuery: '',

  setActiveTab: (tab) => set({ activeTab: tab }),
  openSettings: (tab = 'general') => set({ isSettingsOpen: true, settingsTab: tab }),
  closeSettings: () => set({ isSettingsOpen: false }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  fetchInitialState: async () => {
    if (window.zubridge) {
      try {
        const state = await window.zubridge.getState();
        if (state) {
          const prefs = state.preferences || get().preferences;
          if (typeof document !== 'undefined' && prefs.theme) {
            document.documentElement.classList.toggle('dark', prefs.theme === 'dark');
          }
          set({
            preferences: prefs,
            history: state.history || [],
            dictionary: state.dictionary || [],
            snippets: state.snippets || [],
            notes: state.notes || [],
            meetings: state.meetings || [],
            isRecording: state.isRecording || false,
          });
        }
      } catch (e) {
        console.error('[Store] Failed to get state:', e);
      }
    }

    if (window.electron?.ipc) {
      window.electron.ipc.on('dictation:status-changed', (data: { isRecording: boolean }) => {
        set({ isRecording: data.isRecording });
      });

      window.electron.ipc.on('dictation:result', (item: HistoryItem) => {
        set((state) => ({
          history: [item, ...state.history],
        }));
      });
    }
  },

  toggleDictation: async () => {
    if (window.zubridge) {
      const isRec = await window.zubridge.dispatch('DICTATION_TOGGLE');
      set({ isRecording: isRec });
    }
  },

  setRecordingState: (recordingState) => set({ recordingState }),
  setWaveformData: (waveformData) => set({ waveformData }),

  updatePreferences: async (patch) => {
    if (patch.theme && typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', patch.theme === 'dark');
    }
    if (window.zubridge) {
      const updated = await window.zubridge.dispatch('PREFERENCES_UPDATE', patch);
      if (updated.theme && typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', updated.theme === 'dark');
      }
      set({ preferences: updated });
    } else {
      set((state) => ({ preferences: { ...state.preferences, ...patch } }));
    }
  },

  toggleBookmark: async (id) => {
    if (window.zubridge) {
      await window.zubridge.dispatch('HISTORY_BOOKMARK', id);
    }
    set((state) => ({
      history: state.history.map((h) => (h.id === id ? { ...h, isBookmarked: !h.isBookmarked } : h)),
    }));
  },

  deleteHistory: async (id) => {
    if (window.zubridge) {
      await window.zubridge.dispatch('HISTORY_DELETE', id);
    }
    set((state) => ({
      history: state.history.filter((h) => h.id !== id),
    }));
  },

  addDictionaryItem: async (item) => {
    if (window.zubridge) {
      const added = await window.zubridge.dispatch('DICTIONARY_ADD', item);
      set((state) => ({ dictionary: [added, ...state.dictionary] }));
    }
  },

  deleteDictionaryItem: async (id) => {
    if (window.zubridge) {
      await window.zubridge.dispatch('DICTIONARY_DELETE', id);
    }
    set((state) => ({ dictionary: state.dictionary.filter((d) => d.id !== id) }));
  },

  addSnippet: async (item) => {
    if (window.zubridge) {
      const added = await window.zubridge.dispatch('SNIPPET_ADD', item);
      set((state) => ({ snippets: [added, ...state.snippets] }));
    }
  },

  deleteSnippet: async (id) => {
    if (window.zubridge) {
      await window.zubridge.dispatch('SNIPPET_DELETE', id);
    }
    set((state) => ({ snippets: state.snippets.filter((s) => s.id !== id) }));
  },

  saveNote: async (note) => {
    if (window.zubridge) {
      const saved = await window.zubridge.dispatch('NOTE_SAVE', note);
      set((state) => {
        const filtered = state.notes.filter((n) => n.id !== saved.id);
        return { notes: [saved, ...filtered] };
      });
      return saved;
    }
    const localNote: NoteItem = {
      id: note.id || 'note_' + Date.now(),
      title: note.title,
      content: note.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ notes: [localNote, ...state.notes.filter((n) => n.id !== localNote.id)] }));
    return localNote;
  },

  deleteNote: async (id) => {
    if (window.zubridge) {
      await window.zubridge.dispatch('NOTE_DELETE', id);
    }
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
  },

  transformText: async (text, style, customPrompt) => {
    if (window.electron?.ipc) {
      return await window.electron.ipc.invoke('polish:transform', { text, style, customPrompt });
    }
    return text.toUpperCase();
  },

  finishMeeting: async (meeting) => {
    if (window.electron?.ipc) {
      const saved = await window.electron.ipc.invoke('meeting:finish', meeting);
      set((state) => ({ meetings: [saved, ...state.meetings] }));
      return saved;
    }
    throw new Error('Electron IPC not available');
  },
}));

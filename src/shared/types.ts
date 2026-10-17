export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  activationMode: 'ptt' | 'toggle';
  shortcutDictation: string; // e.g. "Caps Lock" or "Ctrl" or "Ctrl+Space"
  shortcutScratchpad: string;
  shortcutMeeting: string;
  microphoneId: string;
  language: string; // 'auto', 'hi', 'en', 'gu', etc.
  translateMode: boolean; // translate to English
  hinglishMode: boolean; // Devanagari to Roman script transliteration
  soundEffects: boolean;
  
  // STT Providers
  apiProvider: 'huggingface' | 'groq' | 'openai' | 'local';
  hfToken?: string;
  hfModel?: string;
  groqApiKey?: string;
  openaiApiKey?: string;
  // Audio Pipeline & Noise Reduction
  noiseReduction?: 'off' | 'normal' | 'strong';
  hinglishScript?: 'devanagari' | 'roman';
  debugMode?: boolean;
  hfFallbackModels?: string[];
  
  // Custom Flow Bar Position
  customWindowPosition?: { x: number; y: number } | null;
  userName?: string;
}

export interface HistoryItem {
  id: string;
  text: string;
  durationMs: number;
  wordCount: number;
  appName?: string;
  createdAt: string;
  isBookmarked?: boolean;
  hasAudio?: boolean;
  audioDataUrl?: string;
}

export interface DictionaryItem {
  id: string;
  phrase: string;
  replacement?: string;
  isSnippet: boolean;
  category?: 'Personal' | 'Shared with team';
  frequencyUsed: number;
  createdAt: string;
}

export interface SnippetItem {
  id: string;
  trigger: string;
  expansion: string;
  category?: 'Personal' | 'Shared with team';
  createdAt: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingItem {
  id: string;
  title: string;
  transcript: string;
  summary: string;
  actionItems: string[];
  durationMs: number;
  recordedAt: string;
}

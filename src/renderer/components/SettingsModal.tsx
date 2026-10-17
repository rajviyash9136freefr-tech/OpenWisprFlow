import React from 'react';
import { useStore } from '../store/useStore';
import {
  X,
  Sliders,
  Monitor,
  Globe,
  Sun,
  Moon,
  Keyboard,
  RotateCcw,
  Trash2,
  Check,
} from 'lucide-react';
import { BRANDING } from '../../shared/branding';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    closeSettings,
    settingsTab,
    openSettings,
    preferences,
    updatePreferences,
  } = useStore();

  const [isRecordingKey, setIsRecordingKey] = React.useState(false);

  React.useEffect(() => {
    if (!isRecordingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setIsRecordingKey(false);
        return;
      }

      let keyId = '';
      if (e.keyCode === 20 || e.key === 'CapsLock') {
        keyId = 'Caps Lock';
      } else if (e.keyCode === 17 || e.key === 'Control') {
        keyId = 'Ctrl';
      } else {
        keyId = `Custom:${e.keyCode}`;
      }

      updatePreferences({ shortcutDictation: keyId });
      setIsRecordingKey(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isRecordingKey, updatePreferences]);

  const getFriendlyKeyLabel = (id: string) => {
    if (!id || id === 'Caps Lock') return 'Caps Lock (Default)';
    if (id === 'Ctrl') return 'Single Ctrl (Hold)';
    if (id === 'Ctrl+Space') return 'Ctrl + Space';
    if (id.startsWith('Custom:')) {
      const vk = parseInt(id.substring(7), 10);
      const vkNames: Record<number, string> = {
        112: 'F1 Key', 113: 'F2 Key', 114: 'F3 Key', 115: 'F4 Key',
        116: 'F5 Key', 117: 'F6 Key', 118: 'F7 Key', 119: 'F8 Key',
        120: 'F9 Key', 121: 'F10 Key', 122: 'F11 Key', 123: 'F12 Key',
        165: 'Right Alt (AltGr)', 163: 'Right Control', 192: 'Tilde (`~`)',
        220: 'Backslash (`\\`)', 45: 'Insert Key', 36: 'Home Key', 35: 'End Key',
        33: 'Page Up', 34: 'Page Down', 145: 'Scroll Lock', 19: 'Pause/Break',
      };
      return vkNames[vk] || `Custom Key (Code ${vk})`;
    }
    return id;
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans select-none">
      <div className="w-[780px] h-[540px] bg-white dark:bg-[#1C1B18] rounded-2xl shadow-2xl border border-[#E5E4DE] dark:border-white/10 flex overflow-hidden transition-colors">
        {/* Left Settings Sidebar */}
        <div className="w-56 bg-[#F8F8F6] dark:bg-[#22211E] border-r border-[#E5E4DE] dark:border-white/10 p-3 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#A8A7A1] uppercase tracking-wider px-3 py-1.5">
              Settings
            </div>
            <nav className="space-y-0.5 mt-1">
              {[
                { id: 'general', label: 'General & Hotkeys', icon: Sliders },
                { id: 'system', label: 'System & Appearance', icon: Monitor },
                { id: 'languages', label: 'Languages & Hinglish', icon: Globe },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = settingsTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => openSettings(tab.id as any)}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-white dark:bg-[#2A2925] text-[#1A1917] dark:text-[#F2F1ED] shadow-sm shadow-black/5 font-bold'
                        : 'text-[#64635D] dark:text-[#A8A7A0] hover:text-[#1A1917] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[#7A7973]" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="px-3 py-2 text-[11px] text-[#A8A7A1] font-mono border-t border-[#E5E4DE]/60 dark:border-white/10">
            {BRANDING.versionString}
          </div>
        </div>

        {/* Right Settings Content */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto bg-white dark:bg-[#1C1B18] text-[#1A1917] dark:text-[#F2F1ED]">
          {/* Header */}
          <div className="h-14 px-6 border-b border-[#E5E4DE] dark:border-white/10 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1A1917] dark:text-white capitalize">
              {settingsTab === 'system' ? 'System & Appearance' : settingsTab === 'languages' ? 'Languages & Hinglish' : 'General & Hotkeys'}
            </h2>
            <button
              onClick={closeSettings}
              className="p-1.5 rounded-lg text-[#7A7973] hover:text-[#1A1917] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Panels */}
          <div className="p-6 flex-1 space-y-5 overflow-y-auto">
            {/* 1. GENERAL TAB */}
            {settingsTab === 'general' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[#1A1917] dark:text-white">Push-to-Talk Hotkey</label>
                      <p className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                        Hold down the key to record anywhere. Release to transcribe & auto-paste.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/20">
                      Active: {getFriendlyKeyLabel(preferences.shortcutDictation)}
                    </span>
                  </div>

                  {/* Primary Preset Buttons */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {[
                      { id: 'Caps Lock', label: 'Caps Lock (Default)' },
                      { id: 'Ctrl', label: 'Single Ctrl (Hold)' },
                      { id: 'Ctrl+Space', label: 'Ctrl + Space' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => updatePreferences({ shortcutDictation: mode.id })}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          preferences.shortcutDictation === mode.id
                            ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-400 font-bold ring-1 ring-amber-500/30'
                            : 'border-[#E5E4DE] dark:border-white/10 bg-white dark:bg-[#252420] text-[#64635D] dark:text-[#A8A7A0] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  {/* Interactive Custom Key Capture & Reset UI */}
                  <div className="p-3.5 bg-[#F8F8F6] dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1A1917] dark:text-white">Custom Key Binding</span>
                      {preferences.shortcutDictation !== 'Caps Lock' && (
                        <button
                          onClick={() => updatePreferences({ shortcutDictation: 'Caps Lock' })}
                          className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors border border-red-200 dark:border-red-900/30"
                          title="Remove custom key and restore Caps Lock default"
                        >
                          <RotateCcw size={12} />
                          <span>Reset to Caps Lock (Default)</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {isRecordingKey ? (
                        <div className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-amber-500/10 border-2 border-amber-500 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 animate-pulse">
                          <Keyboard size={15} />
                          <span>Press ANY key on your keyboard now... (Esc to cancel)</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsRecordingKey(true)}
                          className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-white dark:bg-[#1E1D1B] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs font-bold text-[#1A1917] dark:text-white hover:border-amber-500 transition-all shadow-sm"
                        >
                          <Keyboard size={15} className="text-amber-500" />
                          <span>Record / Press Any Custom Key</span>
                        </button>
                      )}

                      <select
                        value={
                          ['Ctrl', 'Caps Lock', 'Ctrl+Space'].includes(preferences.shortcutDictation)
                            ? ''
                            : preferences.shortcutDictation
                        }
                        onChange={(e) => {
                          if (e.target.value) {
                            updatePreferences({ shortcutDictation: e.target.value });
                          }
                        }}
                        className="w-44 px-2.5 py-2 border border-[#E5E4DE] dark:border-white/10 bg-white dark:bg-[#1E1D1B] rounded-xl text-xs text-[#1A1917] dark:text-white outline-none focus:border-amber-500"
                      >
                        <option value="" disabled>Or choose preset...</option>
                        <option value="Custom:112">F1 Key</option>
                        <option value="Custom:113">F2 Key</option>
                        <option value="Custom:114">F3 Key</option>
                        <option value="Custom:115">F4 Key</option>
                        <option value="Custom:116">F5 Key</option>
                        <option value="Custom:117">F6 Key</option>
                        <option value="Custom:118">F7 Key</option>
                        <option value="Custom:119">F8 Key</option>
                        <option value="Custom:120">F9 Key</option>
                        <option value="Custom:121">F10 Key</option>
                        <option value="Custom:122">F11 Key</option>
                        <option value="Custom:123">F12 Key</option>
                        <option value="Custom:165">Right Alt (AltGr)</option>
                        <option value="Custom:163">Right Control</option>
                        <option value="Custom:192">Tilde / Grave (`~`)</option>
                        <option value="Custom:220">Backslash (`\`)</option>
                        <option value="Custom:45">Insert Key</option>
                        <option value="Custom:145">Scroll Lock</option>
                      </select>
                    </div>

                    <p className="text-[11px] text-[#717069] dark:text-[#A8A7A0]">
                      Click "Record" and press any key to bind it. If a custom key causes errors or doesn't work on your keyboard, click "Reset to Caps Lock" to immediately restore the default.
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#E5E4DE] dark:border-white/10 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1A1917] dark:text-white">Audio & Sound Effects</div>
                      <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">Play subtle acoustic chimes on start, stop, and paste</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.soundEffects}
                      onChange={(e) => updatePreferences({ soundEffects: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1A1917] dark:text-white">Your Name</div>
                      <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">Personalized greeting on the main dashboard</div>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter your name..."
                      value={preferences.userName || ''}
                      onChange={(e) => updatePreferences({ userName: e.target.value })}
                      className="w-48 px-3 py-1.5 border border-[#E5E4DE] dark:border-white/10 bg-white dark:bg-[#252420] rounded-xl text-xs text-[#1A1917] dark:text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. SYSTEM & APPEARANCE TAB */}
            {settingsTab === 'system' && (
              <div className="space-y-5">
                {/* Dark Mode / Light Mode Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#1A1917] dark:text-white">Theme & Appearance</label>
                  <p className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                    Choose between the authentic warm stone light mode or deep dark mode.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => updatePreferences({ theme: 'light' })}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border text-xs font-semibold transition-all ${
                        preferences.theme !== 'dark'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-400 font-bold ring-1 ring-amber-500/30'
                          : 'border-[#E5E4DE] dark:border-white/10 bg-white dark:bg-[#252420] text-[#64635D] dark:text-[#A8A7A0]'
                      }`}
                    >
                      <Sun size={16} />
                      <span>Light Mode (Warm Stone)</span>
                    </button>

                    <button
                      onClick={() => updatePreferences({ theme: 'dark' })}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border text-xs font-semibold transition-all ${
                        preferences.theme === 'dark'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-bold ring-1 ring-amber-500/30'
                          : 'border-[#E5E4DE] dark:border-white/10 bg-white dark:bg-[#252420] text-[#64635D] dark:text-[#A8A7A0]'
                      }`}
                    >
                      <Moon size={16} />
                      <span>Dark Mode (Deep Slate)</span>
                    </button>
                  </div>
                </div>

                {/* Reset Flow Bar Position */}
                <div className="border-t border-[#E5E4DE] dark:border-white/10 pt-4">
                  <div className="flex items-center justify-between p-3.5 border border-[#E5E4DE] dark:border-white/10 rounded-xl bg-[#F8F8F6] dark:bg-[#252420]">
                    <div>
                      <div className="text-xs font-bold text-[#1A1917] dark:text-white">Reset Flow Bar Position</div>
                      <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                        Re-centers the floating capsule widget to the bottom of your primary screen
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (window.electron?.ipc) {
                          window.electron.ipc.send('overlay:drag-move', { deltaX: 0, deltaY: 0 });
                        }
                        updatePreferences({ customWindowPosition: null });
                      }}
                      className="px-3.5 py-1.5 bg-white dark:bg-[#1E1D1B] border border-[#E5E4DE] dark:border-white/10 rounded-lg text-xs font-bold text-[#1A1917] dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    >
                      Reset Position
                    </button>
                  </div>
                </div>

                {/* Noise Reduction Setting */}
                <div className="space-y-1.5 border-t border-[#E5E4DE] dark:border-white/10 pt-4">
                  <label className="text-xs font-bold text-[#1A1917] dark:text-white">Microphone Noise Reduction</label>
                  <p className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                    High-pass 85Hz filter, adaptive spectral gate & VAD to remove fan hum, AC rumble, and room noise.
                  </p>
                  <select
                    value={preferences.noiseReduction || 'normal'}
                    onChange={(e) => updatePreferences({ noiseReduction: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 text-[#1A1917] dark:text-white"
                  >
                    <option value="normal">Normal (Recommended - 85Hz High-Pass + Spectral Gate)</option>
                    <option value="strong">Strong (Aggressive suppression for noisy rooms & fans)</option>
                    <option value="off">Off (Raw unprocessed audio)</option>
                  </select>
                </div>

                {/* Whisper Model Selection */}
                <div className="space-y-1.5 border-t border-[#E5E4DE] dark:border-white/10 pt-4">
                  <label className="text-xs font-bold text-[#1A1917] dark:text-white">Whisper Speech-to-Text Model</label>
                  <p className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                    Select the primary Whisper-family inference model.
                  </p>
                  <select
                    value={preferences.hfModel || 'openai/whisper-large-v3-turbo'}
                    onChange={(e) => updatePreferences({ hfModel: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 text-[#1A1917] dark:text-white"
                  >
                    <option value="openai/whisper-large-v3-turbo">openai/whisper-large-v3-turbo (Recommended - Ultra-fast & accurate)</option>
                    <option value="openai/whisper-large-v3">openai/whisper-large-v3 (Comprehensive Whisper large)</option>
                  </select>
                </div>

                {/* Debug Diagnostics Mode Toggle */}
                <div className="flex items-center justify-between border-t border-[#E5E4DE] dark:border-white/10 pt-4">
                  <div>
                    <div className="text-xs font-bold text-[#1A1917] dark:text-white">Debug Diagnostics Mode</div>
                    <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                      Saves raw recording, processed 16kHz WAV, and API request/response logs to disk
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.debugMode)}
                    onChange={(e) => updatePreferences({ debugMode: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}



            {/* 4. LANGUAGES & HINGLISH TAB */}
            {settingsTab === 'languages' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1A1917] dark:text-white">Spoken Language</label>
                  <select
                    value={preferences.language}
                    onChange={(e) => updatePreferences({ language: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 text-[#1A1917] dark:text-white"
                  >
                    <option value="auto">Auto-detect (Recommended)</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="hinglish">Hinglish (Hindi + English Mixed)</option>
                    <option value="en">English</option>
                    <option value="gu">Gujarati (ગુજરાતી)</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>

                <div className="border-t border-[#E5E4DE] dark:border-white/10 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1A1917] dark:text-white">Hinglish Mode (Mixed Speech)</div>
                      <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                        Transcribes natural colloquial Hindi & English speech accurately
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.hinglishMode || preferences.language === 'hinglish'}
                      onChange={(e) => updatePreferences({ hinglishMode: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </div>

                  {/* Hinglish Output Script Choice */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1A1917] dark:text-white">Hinglish Output Script</div>
                      <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                        Choose Latin alphabet (Roman) or Devanagari script (हिंदी)
                      </div>
                    </div>
                    <select
                      value={preferences.hinglishScript || 'roman'}
                      onChange={(e) => updatePreferences({ hinglishScript: e.target.value as any })}
                      className="w-48 px-3 py-1.5 bg-white dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 text-[#1A1917] dark:text-white"
                    >
                      <option value="roman">Roman Script (Aap kaise hain)</option>
                      <option value="devanagari">Devanagari Script (आप कैसे हैं)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1A1917] dark:text-white">Live English Translation</div>
                      <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                        Automatically translates any spoken language directly into English text
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.translateMode}
                      onChange={(e) => updatePreferences({ translateMode: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Save */}
          <div className="h-14 px-6 border-t border-[#E5E4DE] dark:border-white/10 bg-[#F8F8F6] dark:bg-[#22211E] flex items-center justify-end">
            <button
              onClick={closeSettings}
              className="px-5 py-2 bg-[#1A1917] dark:bg-white text-white dark:text-[#1A1917] hover:bg-black text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

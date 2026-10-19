import React, { useState } from 'react';
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
  Cpu,
  Key,
  ExternalLink,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
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

  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

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

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      if (window.electron?.ipc) {
        const res = await window.electron.ipc.invoke('api:test-connection', preferences);
        setTestResult(res);
      } else {
        setTestResult({ success: true, message: 'Settings saved in browser preview.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

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
      <div className="w-[820px] h-[580px] bg-white dark:bg-[#1C1B18] rounded-2xl shadow-2xl border border-[#E5E4DE] dark:border-white/10 flex overflow-hidden transition-colors">
        {/* Left Settings Sidebar */}
        <div className="w-56 bg-[#F8F8F6] dark:bg-[#22211E] border-r border-[#E5E4DE] dark:border-white/10 p-3 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#A8A7A1] uppercase tracking-wider px-3 py-1.5">
              Settings
            </div>
            <nav className="space-y-0.5 mt-1">
              {[
                { id: 'general', label: 'General & Hotkeys', icon: Sliders },
                { id: 'ai', label: 'AI & Speech Engines', icon: Cpu },
                { id: 'system', label: 'System & Audio', icon: Monitor },
                { id: 'languages', label: 'Languages & Hinglish', icon: Globe },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = settingsTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      openSettings(tab.id as any);
                      setTestResult(null);
                    }}
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
              {settingsTab === 'system'
                ? 'System & Audio'
                : settingsTab === 'languages'
                ? 'Languages & Hinglish'
                : settingsTab === 'ai'
                ? 'AI & Speech Engines'
                : 'General & Hotkeys'}
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
                      Click "Record" and press any key to bind it.
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

            {/* 2. AI & SPEECH ENGINES TAB */}
            {settingsTab === 'ai' && (
              <div className="space-y-5">
                {/* Engine Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-[#1A1917] dark:text-white">Transcription Engine</label>
                      <p className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                        Select which speech-to-text service powers dictation across all your apps.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    {[
                      {
                        id: 'groq',
                        title: 'Groq Cloud (Recommended)',
                        desc: '0.2s ultra-fast Whisper Large v3 Turbo. Free 14,400 req/day.',
                        badge: 'Fastest & Free',
                      },
                      {
                        id: 'openai',
                        title: 'OpenAI Whisper',
                        desc: 'Official OpenAI cloud transcription using whisper-1 model.',
                        badge: 'Cloud',
                      },
                      {
                        id: 'huggingface',
                        title: 'Hugging Face Inference',
                        desc: 'Serverless inference router using personal HF token.',
                        badge: 'Cloud',
                      },
                      {
                        id: 'local',
                        title: 'Local CUDA GPU Whisper',
                        desc: 'Zero-cloud offline inference via Python/CUDA daemon.',
                        badge: 'Offline',
                      },
                    ].map((engine) => (
                      <button
                        key={engine.id}
                        onClick={() => {
                          updatePreferences({ apiProvider: engine.id as any });
                          setTestResult(null);
                        }}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          (preferences.apiProvider || 'groq') === engine.id
                            ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-400 font-bold ring-1 ring-amber-500/30'
                            : 'border-[#E5E4DE] dark:border-white/10 bg-white dark:bg-[#252420] text-[#64635D] dark:text-[#A8A7A0] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#1A1917] dark:text-white">{engine.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#717069] dark:text-[#A8A7A0] font-mono">
                            {engine.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#717069] dark:text-[#A8A7A0] font-normal leading-relaxed">
                          {engine.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Groq Key Configuration */}
                {(preferences.apiProvider === 'groq' || !preferences.apiProvider) && (
                  <div className="p-4 bg-[#F8F8F6] dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-amber-500" />
                        <span className="text-xs font-bold text-[#1A1917] dark:text-white">Groq API Key</span>
                      </div>
                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                      >
                        <span>Get Free Key (Instant, 10s signup)</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                    <input
                      type="password"
                      placeholder="Paste your Groq API key here (gsk_...)"
                      value={preferences.groqApiKey || ''}
                      onChange={(e) => updatePreferences({ groqApiKey: e.target.value.trim() })}
                      className="w-full px-3 py-2 bg-white dark:bg-[#1C1B18] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs text-[#1A1917] dark:text-white font-mono outline-none focus:border-amber-500"
                    />
                    <p className="text-[11px] text-[#717069] dark:text-[#A8A7A0]">
                      Groq transcribes full 60-second long sentences in ~200ms with Whisper Large v3 Turbo. Free tier includes 14,400 requests per day with zero billing.
                    </p>
                  </div>
                )}

                {/* OpenAI Key Configuration */}
                {preferences.apiProvider === 'openai' && (
                  <div className="p-4 bg-[#F8F8F6] dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-amber-500" />
                        <span className="text-xs font-bold text-[#1A1917] dark:text-white">OpenAI API Key</span>
                      </div>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                      >
                        <span>Get OpenAI Key</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                    <input
                      type="password"
                      placeholder="Paste your OpenAI API key (sk-...)"
                      value={preferences.openaiApiKey || ''}
                      onChange={(e) => updatePreferences({ openaiApiKey: e.target.value.trim() })}
                      className="w-full px-3 py-2 bg-white dark:bg-[#1C1B18] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs text-[#1A1917] dark:text-white font-mono outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Hugging Face Token Configuration */}
                {preferences.apiProvider === 'huggingface' && (
                  <div className="p-4 bg-[#F8F8F6] dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-amber-500" />
                        <span className="text-xs font-bold text-[#1A1917] dark:text-white">Hugging Face User Access Token</span>
                      </div>
                      <a
                        href="https://huggingface.co/settings/tokens"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                      >
                        <span>Create Token</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                    <input
                      type="password"
                      placeholder="Paste your Hugging Face token (hf_...)"
                      value={preferences.hfToken || ''}
                      onChange={(e) => updatePreferences({ hfToken: e.target.value.trim() })}
                      className="w-full px-3 py-2 bg-white dark:bg-[#1C1B18] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs text-[#1A1917] dark:text-white font-mono outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Local Daemon status */}
                {preferences.apiProvider === 'local' && (
                  <div className="p-4 bg-[#F8F8F6] dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-[#1A1917] dark:text-white">Local Python Daemon</span>
                    <p className="text-[11px] text-[#717069] dark:text-[#A8A7A0]">
                      Runs whisper on your local NVIDIA GPU via `whisper_daemon.py`. Requires PyTorch and CUDA.
                    </p>
                  </div>
                )}

                {/* Smart Auto-Structuring Toggle */}
                <div className="p-4 bg-[#F8F8F6] dark:bg-[#252420] border border-[#E5E4DE] dark:border-white/10 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#1A1917] dark:text-white flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-500" />
                      <span>Wispr Smart Auto-Structuring</span>
                    </div>
                    <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                      Automatically format long speech into bullet points, numbered lists, and clean paragraphs.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.smartStructuring !== false}
                    onChange={(e) => updatePreferences({ smartStructuring: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                {/* Test Connection Button & Status */}
                <div className="border-t border-[#E5E4DE] dark:border-white/10 pt-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#1A1917] dark:text-white">Verify Connection</div>
                    <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                      Ping the selected provider to verify keys, permissions, and network latency.
                    </div>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex items-center space-x-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-400'
                    }`}
                  >
                    {testResult.success ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                    <span className="font-medium">{testResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* 3. SYSTEM & AUDIO TAB */}
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
              className="px-5 py-2 bg-[#1A1917] dark:bg-white text-white dark:text-[#1A1917] hover:bg-black text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

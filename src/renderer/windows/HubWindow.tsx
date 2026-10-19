import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Sidebar } from '../components/Sidebar';
import { SettingsModal } from '../components/SettingsModal';
import { OnboardingModal } from '../components/OnboardingModal';
import { OpenWisprLogo } from '../components/OpenWisprLogo';
import {
  Search,
  Copy,
  Check,
  Bookmark,
  Trash2,
  Plus,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  Users,
  Mic,
  Clock,
  Play,
  Pause,
  Volume2,
  Loader2,
} from 'lucide-react';
import { HistoryItem } from '../../shared/types';

export const HubWindow: React.FC = () => {
  const {
    activeTab,
    history,
    dictionary,
    snippets,
    preferences,
    updatePreferences,
    searchQuery,
    setSearchQuery,
    toggleBookmark,
    deleteHistory,
    addDictionaryItem,
    deleteDictionaryItem,
    addSnippet,
    deleteSnippet,
    openSettings,
    transformText,
    fetchInitialState,
  } = useStore();

  useEffect(() => {
    fetchInitialState();
  }, [fetchInitialState]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!preferences.hasCompletedOnboarding && !preferences.groqApiKey && !preferences.openaiApiKey && !preferences.hfToken) {
      setIsOnboardingOpen(true);
    }
  }, [preferences.hasCompletedOnboarding, preferences.groqApiKey, preferences.openaiApiKey, preferences.hfToken]);

  // Dictionary state
  const [newWord, setNewWord] = useState('');
  const [newReplacement, setNewReplacement] = useState('');

  // Snippets state
  const [newTrigger, setNewTrigger] = useState('');
  const [newExpansion, setNewExpansion] = useState('');

  // Transforms / Polish state
  const [polishInput, setPolishInput] = useState('');
  const [polishStyle, setPolishStyle] = useState<'formal' | 'casual' | 'bullet' | 'concise' | 'grammar'>('formal');
  const [polishOutput, setPolishOutput] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);

  // Audio Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlay = async (item: HistoryItem) => {
    // If currently playing this item, pause it
    if (playingId === item.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    // Stop previous audio if any
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setLoadingAudioId(item.id);

    try {
      let audioUrl = item.audioDataUrl;
      if (!audioUrl && window.electron?.ipc) {
        audioUrl = await window.electron.ipc.invoke('history:get-audio', item.id);
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setPlayingId(null);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setPlayingId(null);
          audioRef.current = null;
        };
        await audio.play();
        setPlayingId(item.id);
      } else {
        // Fallback for older items before audio saving: speech synthesis
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(item.text);
          utter.onend = () => setPlayingId(null);
          utter.onerror = () => setPlayingId(null);
          setPlayingId(item.id);
          window.speechSynthesis.speak(utter);
        }
      }
    } catch (err) {
      console.error('[HubWindow] Audio playback error:', err);
      setPlayingId(null);
    } finally {
      setLoadingAudioId(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    if (window.electron?.clipboard) {
      window.electron.clipboard.writeText(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRunPolish = async () => {
    if (!polishInput.trim()) return;
    setIsPolishing(true);
    try {
      const res = await transformText(polishInput, polishStyle);
      setPolishOutput(res);
    } finally {
      setIsPolishing(false);
    }
  };

  // 1. Dynamic Total Words (Defaults to 00)
  const totalWords = useMemo(() => {
    return history.reduce((acc, h) => acc + (h.wordCount || 0), 0);
  }, [history]);

  // 2. Dynamic Average Speaking Speed (WPM) (Defaults to 0)
  const averageWpm = useMemo(() => {
    if (history.length === 0) return 0;
    const totalMinutes = history.reduce((acc, item) => acc + (item.durationMs || 3000) / 60000, 0);
    if (totalMinutes <= 0) return 0;
    return Math.round(totalWords / totalMinutes);
  }, [history, totalWords]);

  // 3. Dynamic Day Streak & Broken Status
  const streakInfo = useMemo(() => {
    if (history.length === 0) {
      return { streak: 0, isBroken: false };
    }
    // Extract unique dates in YYYY-MM-DD
    const dates = Array.from(
      new Set(
        history.map((h) => {
          const d = new Date(h.createdAt);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })
      )
    ).sort().reverse(); // newest first

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (dates.length === 0) return { streak: 0, isBroken: false };

    // Check if user has dictated today or yesterday
    const lastActiveDate = dates[0];
    if (lastActiveDate !== todayStr && lastActiveDate !== yesterdayStr) {
      // Streak broken!
      return { streak: 0, isBroken: true };
    }

    // Count consecutive days
    let streak = 0;
    let curr = lastActiveDate === todayStr ? today : yesterday;
    for (const dStr of dates) {
      const expStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      if (dStr === expStr) {
        streak++;
        curr = new Date(curr.getTime() - 86400000);
      } else {
        break;
      }
    }

    return { streak, isBroken: false };
  }, [history]);

  // 4. Dynamic Total Days Active Counter
  const totalDaysActive = useMemo(() => {
    if (history.length === 0) return 0;
    const uniqueDays = new Set(
      history.map((h) => {
        const d = new Date(h.createdAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    );
    return uniqueDays.size;
  }, [history]);

  const filteredHistory = history.filter((h) =>
    h.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen bg-[#F8F8F6] dark:bg-[#181816] text-[#1A1917] dark:text-[#F2F1ED] overflow-hidden font-sans select-none transition-colors">
      {/* 1. Left Sidebar */}
      <Sidebar />

      {/* 2. Main Workspace */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* TAB 1: DICTATION (HOME DASHBOARD) */}
        {activeTab === 'dictation' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
            {/* Top Greeting */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xl font-bold text-[#1A1917] dark:text-white">
                <span>{preferences.userName ? `Welcome back, ${preferences.userName}!` : 'Get back into the flow with'}</span>
                <span className="px-2.5 py-0.5 rounded-lg border border-[#F59E0B]/50 bg-[#F59E0B]/15 text-[#B45309] dark:text-amber-400 font-mono text-sm font-bold shadow-sm">
                  {preferences.shortcutDictation || 'Caps Lock'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOnboardingOpen(true)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E5E4DE] dark:border-white/10 bg-white dark:bg-[#22211E] text-xs font-bold hover:border-amber-500/50 transition-all flex items-center gap-1.5 text-[#1A1917] dark:text-white shadow-sm cursor-pointer"
              >
                <Sparkles size={13} className="text-amber-500" />
                <span>Setup Wizard</span>
              </button>
            </div>

            {/* Fast-Track Engine Setup Banner */}
            {!preferences.groqApiKey && !preferences.openaiApiKey && !preferences.hfToken && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#1A1917] dark:text-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Connect AI Speech Engine (Free & Instant)</div>
                    <div className="text-xs text-[#717069] dark:text-[#A8A7A0]">
                      Add your free Groq API key for 0.2s ultra-fast speech dictation with perfect Hindi, Hinglish & English support.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOnboardingOpen(true)}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
                  >
                    Quick Setup Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => openSettings('ai')}
                    className="px-3 py-2 bg-white dark:bg-[#282724] border border-[#E5E4DE] dark:border-white/10 text-[#1A1917] dark:text-white hover:bg-zinc-50 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
                  >
                    Settings
                  </button>
                </div>
              </div>
            )}

            {/* Two Column Grid */}
            <div className="grid grid-cols-10 gap-6">
              {/* Left Column (Timeline & Hero) */}
              <div className="col-span-7 space-y-5">
                {/* Hero Banner Card */}
                <div className="relative overflow-hidden rounded-2xl bg-[#1A1917] text-white p-7 shadow-lg border border-black/10 dark:border-white/10 flex items-center justify-between">
                  <div className="space-y-2 max-w-md z-10">
                    <h3 className="text-2xl font-serif-title font-medium text-amber-50">
                      Make Open Wispr sound like you
                    </h3>
                    <p className="text-xs text-[#A8A7A1] leading-relaxed">
                      Set up different writing styles for different apps, from casual chat to executive emails.
                    </p>
                    <button
                      onClick={() => openSettings('languages')}
                      className="mt-3 px-4 py-2 bg-white text-[#1A1917] hover:bg-zinc-100 rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      Start now
                    </button>
                  </div>
                  {/* Subtle decorative glow */}
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-amber-500/20 to-transparent pointer-events-none" />
                </div>

                {/* History Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-[#E5E4DE] dark:border-white/10 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#717069] dark:text-[#A8A7A0]">
                      TODAY
                    </span>
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#7A7973]" />
                      <input
                        type="text"
                        placeholder="Search transcripts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1 bg-white dark:bg-[#22211E] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 w-48 text-[#1A1917] dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Transcripts List */}
                  <div className="space-y-2.5">
                    {filteredHistory.length === 0 ? (
                      <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#E5E4DE] dark:border-white/10 bg-white/40 dark:bg-[#22211E]/40 space-y-2">
                        <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                          <Mic size={20} />
                        </div>
                        <div className="text-sm font-semibold text-[#1A1917] dark:text-white">
                          No dictations yet
                        </div>
                        <p className="text-xs text-[#717069] dark:text-[#8E8D86] max-w-xs mx-auto">
                          Hold down your global hotkey (<span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{preferences.shortcutDictation || 'Ctrl'}</span>) and speak anywhere to start voice-typing.
                        </p>
                      </div>
                    ) : (
                      filteredHistory.map((item) => (
                        <div
                          key={item.id}
                          className="group bg-white dark:bg-[#22211E] p-4 rounded-xl border border-[#E5E4DE] dark:border-white/10 hover:border-amber-500/40 hover:shadow-sm transition-all flex items-start justify-between space-x-3.5"
                        >
                          {/* Play / Pause Voice Recording Button */}
                          <button
                            onClick={() => handleTogglePlay(item)}
                            disabled={loadingAudioId === item.id}
                            className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                              playingId === item.id
                                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-105 ring-2 ring-amber-400/50'
                                : 'bg-[#F2F1ED] dark:bg-[#2A2925] text-[#717069] dark:text-[#D5D4CE] hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 dark:hover:text-white'
                            }`}
                            title={playingId === item.id ? "Pause recording" : "Play voice recording"}
                          >
                            {loadingAudioId === item.id ? (
                              <Loader2 size={13} className="animate-spin text-amber-500" />
                            ) : playingId === item.id ? (
                              <Pause size={13} />
                            ) : (
                              <Play size={13} className="ml-0.5" />
                            )}
                          </button>

                          <div className="space-y-1.5 flex-1">
                            <p className="text-xs text-[#1A1917] dark:text-[#F2F1ED] leading-relaxed font-normal">
                              {item.text}
                            </p>
                            <div className="flex items-center space-x-2 text-[10px] text-[#9E9D95]">
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span>•</span>
                              <span>{item.wordCount} words</span>
                              <span>•</span>
                              <span>{((item.durationMs || 1000) / 1000).toFixed(1)}s</span>
                              <span>•</span>
                              <span className="font-semibold text-amber-800/80 dark:text-amber-400">{item.appName || 'Active App'}</span>
                              {item.hasAudio && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                    <Volume2 size={10} />
                                    <span>Voice</span>
                                  </span>
                                </>
                              )}
                              {playingId === item.id && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1 text-amber-500 font-semibold animate-pulse">
                                    <span className="w-1 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1 h-3.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    <span className="text-[10px] ml-0.5">Playing...</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleCopy(item.text, item.id)}
                              className="p-1.5 rounded-lg text-[#7A7973] hover:text-[#1A1917] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                              title="Copy text"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => toggleBookmark(item.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                item.isBookmarked
                                  ? 'text-amber-500'
                                  : 'text-[#7A7973] hover:text-[#1A1917] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                              }`}
                              title="Bookmark"
                            >
                              <Bookmark className="w-3.5 h-3.5" fill={item.isBookmarked ? 'currentColor' : 'none'} />
                            </button>
                            <button
                              onClick={() => deleteHistory(item.id)}
                              className="p-1.5 rounded-lg text-[#7A7973] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (Metrics & Voice Profile) */}
              <div className="col-span-3 space-y-4">
                {/* Stats Card */}
                <div className="bg-white dark:bg-[#22211E] border border-[#E5E4DE] dark:border-white/10 p-5 rounded-2xl space-y-4 shadow-sm transition-colors">
                  <div>
                    <div className="text-2xl font-bold text-[#1A1917] dark:text-white tracking-tight">
                      {totalWords.toLocaleString()}
                    </div>
                    <div className="text-xs text-[#717069] dark:text-[#A8A7A0] font-medium">total words</div>
                  </div>

                  <div className="border-t border-[#E5E4DE]/60 dark:border-white/10 pt-3">
                    <div className="text-xl font-bold text-[#1A1917] dark:text-white tracking-tight">
                      {averageWpm} <span className="text-xs font-normal text-[#717069] dark:text-[#A8A7A0]">wpm</span>
                    </div>
                    <div className="text-xs text-[#717069] dark:text-[#A8A7A0] font-medium">speaking speed</div>
                  </div>

                  <div className="border-t border-[#E5E4DE]/60 dark:border-white/10 pt-3">
                    {streakInfo.isBroken ? (
                      <div>
                        <div className="text-xl font-bold text-rose-500 tracking-tight">
                          0 day <span className="text-xs font-normal text-rose-400">streak</span>
                        </div>
                        <div className="text-xs text-rose-500 font-medium">streak broken (speak to restart)</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xl font-bold text-[#1A1917] dark:text-white tracking-tight">
                          {streakInfo.streak} day <span className="text-xs font-normal text-[#717069] dark:text-[#A8A7A0]">streak</span>
                        </div>
                        <div className="text-xs text-[#717069] dark:text-[#A8A7A0] font-medium">consistency</div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#E5E4DE]/60 dark:border-white/10 pt-3">
                    <div className="text-xl font-bold text-[#1A1917] dark:text-white tracking-tight">
                      {totalDaysActive} <span className="text-xs font-normal text-[#717069] dark:text-[#A8A7A0]">days</span>
                    </div>
                    <div className="text-xs text-[#717069] dark:text-[#A8A7A0] font-medium">days active</div>
                  </div>
                </div>

                {/* Voice Profile Card (Unlimited Words) */}
                <div className="bg-white dark:bg-[#22211E] border border-[#E5E4DE] dark:border-white/10 p-5 rounded-2xl space-y-3 shadow-sm transition-colors">
                  <div className="text-xs font-bold text-[#1A1917] dark:text-white flex items-center justify-between">
                    <span>Your Voice Profile</span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Unlimited</span>
                  </div>
                  <p className="text-[11px] text-[#717069] dark:text-[#A8A7A0] leading-relaxed">
                    Discover how you use your voice and unlock personalized vocabulary tuning with zero subscription limits.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full bg-[#F2F1ED] dark:bg-[#181816] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(5, (totalWords / 500) * 100))}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-[#9E9D95] text-right font-medium">
                      {totalWords.toLocaleString()} words spoken • Unlimited
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DICTIONARY */}
        {activeTab === 'dictionary' && (
          <div className="p-8 max-w-4xl w-full mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-[#1A1917] dark:text-white">Dictionary</h1>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="New word or jargon..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-[#22211E] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 w-44 text-[#1A1917] dark:text-white"
                />
                <button
                  onClick={() => {
                    if (newWord.trim()) {
                      addDictionaryItem({ phrase: newWord.trim(), replacement: newReplacement.trim(), isSnippet: false });
                      setNewWord('');
                      setNewReplacement('');
                    }
                  }}
                  className="px-3 py-1.5 bg-[#1A1917] dark:bg-white text-white dark:text-[#1A1917] rounded-xl text-xs font-bold hover:bg-black transition-colors"
                >
                  Add word
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-[#22211E] border border-[#E5E4DE] dark:border-white/10 rounded-2xl p-6 shadow-sm">
              <h3 className="font-serif-title text-xl text-[#1A1917] dark:text-white font-medium mb-1">
                Open Wispr spells the way you do.
              </h3>
              <p className="text-xs text-[#717069] dark:text-[#A8A7A0] mb-4">
                Add uncommon names, acronyms, and industry terms so the transcription engine never misspells them.
              </p>

              <div className="space-y-2">
                {dictionary.length === 0 ? (
                  <div className="text-xs text-[#8E8D86] py-4 text-center">No dictionary items added yet.</div>
                ) : (
                  dictionary.map((dict) => (
                    <div
                      key={dict.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#E5E4DE]/60 dark:border-white/10 hover:border-amber-500/40 bg-[#F8F8F6] dark:bg-[#181816] transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[#1A1917] dark:text-white">{dict.phrase}</div>
                        {dict.replacement && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-400">➔ {dict.replacement}</div>
                        )}
                      </div>
                      <button
                        onClick={() => deleteDictionaryItem(dict.id)}
                        className="text-[#7A7973] hover:text-red-600 p-1 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SNIPPETS */}
        {activeTab === 'snippets' && (
          <div className="p-8 max-w-4xl w-full mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-[#1A1917] dark:text-white">Snippets</h1>
            </div>

            <div className="bg-white dark:bg-[#22211E] border border-[#E5E4DE] dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-serif-title text-xl text-[#1A1917] dark:text-white font-medium">
                The stuff you shouldn't have to re-type.
              </h3>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <input
                  type="text"
                  placeholder="Trigger phrase (e.g. 'my email')..."
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  className="px-3.5 py-2 bg-[#F8F8F6] dark:bg-[#181816] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 text-[#1A1917] dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Expands to (e.g. 'hello@mycompany.com')..."
                  value={newExpansion}
                  onChange={(e) => setNewExpansion(e.target.value)}
                  className="px-3.5 py-2 bg-[#F8F8F6] dark:bg-[#181816] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 text-[#1A1917] dark:text-white"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (newTrigger.trim() && newExpansion.trim()) {
                      addSnippet({ trigger: newTrigger.trim(), expansion: newExpansion.trim() });
                      setNewTrigger('');
                      setNewExpansion('');
                    }
                  }}
                  className="px-4 py-2 bg-[#1A1917] dark:bg-white text-white dark:text-[#1A1917] rounded-xl text-xs font-bold hover:bg-black transition-colors"
                >
                  Create Snippet
                </button>
              </div>

              <div className="space-y-2 pt-2">
                {snippets.map((snip) => (
                  <div
                    key={snip.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#E5E4DE]/60 dark:border-white/10 bg-[#F8F8F6] dark:bg-[#181816]"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                        {snip.trigger}
                      </span>
                      <span className="mx-2 text-xs text-[#9E9D95]">➔</span>
                      <span className="text-xs text-[#1A1917] dark:text-white">{snip.expansion}</span>
                    </div>
                    <button
                      onClick={() => deleteSnippet(snip.id)}
                      className="text-[#7A7973] hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: STYLE */}
        {activeTab === 'style' && (
          <div className="p-8 max-w-4xl w-full mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-[#1A1917] dark:text-white">Style & AI Transforms</h1>

            <div className="bg-white dark:bg-[#22211E] border border-[#E5E4DE] dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-serif-title text-xl text-[#1A1917] dark:text-white font-medium">
                Transform voice transcripts to match your exact tone.
              </h3>

              <div className="flex gap-2">
                {(['formal', 'casual', 'concise', 'bullet', 'grammar'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setPolishStyle(style)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                      polishStyle === style
                        ? 'bg-amber-500 text-white font-bold'
                        : 'bg-[#F2F1ED] dark:bg-[#181816] text-[#717069] dark:text-[#A8A7A0] hover:text-[#1A1917] dark:hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>

              <textarea
                value={polishInput}
                onChange={(e) => setPolishInput(e.target.value)}
                placeholder="Paste or dictate text here to polish..."
                rows={4}
                className="w-full p-3.5 bg-[#F8F8F6] dark:bg-[#181816] border border-[#E5E4DE] dark:border-white/10 rounded-xl text-xs text-[#1A1917] dark:text-white outline-none focus:border-amber-500"
              />

              <div className="flex justify-end">
                <button
                  onClick={handleRunPolish}
                  disabled={isPolishing || !polishInput.trim()}
                  className="px-4 py-2 bg-[#1A1917] dark:bg-white text-white dark:text-[#1A1917] rounded-xl text-xs font-bold hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles size={14} className="text-amber-400" />
                  <span>{isPolishing ? 'Polishing...' : 'Transform Text'}</span>
                </button>
              </div>

              {polishOutput && (
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-400">Polished Result</div>
                  <p className="text-xs text-[#1A1917] dark:text-[#F2F1ED] leading-relaxed">{polishOutput}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: INSIGHTS */}
        {activeTab === 'insights' && (
          <div className="p-8 max-w-4xl w-full mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-[#1A1917] dark:text-white">Productivity Insights</h1>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-5 bg-white dark:bg-[#22211E] rounded-2xl border border-[#E5E4DE] dark:border-white/10 shadow-sm">
                <div className="text-2xl font-bold text-[#1A1917] dark:text-white">{averageWpm} WPM</div>
                <div className="text-xs text-[#717069] dark:text-[#A8A7A0] mt-1">Average speaking speed</div>
              </div>
              <div className="p-5 bg-white dark:bg-[#22211E] rounded-2xl border border-[#E5E4DE] dark:border-white/10 shadow-sm">
                <div className="text-2xl font-bold text-[#1A1917] dark:text-white">{totalWords.toLocaleString()}</div>
                <div className="text-xs text-[#717069] dark:text-[#A8A7A0] mt-1">Total words transcribed</div>
              </div>
              <div className="p-5 bg-white dark:bg-[#22211E] rounded-2xl border border-[#E5E4DE] dark:border-white/10 shadow-sm">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {streakInfo.isBroken ? '0' : streakInfo.streak} Days
                </div>
                <div className="text-xs text-[#717069] dark:text-[#A8A7A0] mt-1">Consistency streak</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SCRATCHPAD */}
        {activeTab === 'scratchpad' && (
          <div className="p-8 max-w-4xl w-full mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-[#1A1917] dark:text-white">Scratchpad Voice Notes</h1>
            <p className="text-xs text-[#717069] dark:text-[#A8A7A0]">
              Open your dedicated voice notes scratchpad window from the tray or press CommandOrControl+Shift+N.
            </p>
            <button
              onClick={() => {
                if (window.electron?.ipc) {
                  window.electron.ipc.invoke('scratchpad:open');
                }
              }}
              className="px-4 py-2 bg-[#1A1917] dark:bg-white text-white dark:text-[#1A1917] rounded-xl text-xs font-bold shadow-sm"
            >
              Open Floating Scratchpad
            </button>
          </div>
        )}
      </main>

      {/* 3. Interactive First-Time Setup & Onboarding Wizard */}
      <OnboardingModal isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} />

      {/* 4. Settings Dialog */}
      <SettingsModal />
    </div>
  );
};

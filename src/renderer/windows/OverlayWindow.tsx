import React, { useEffect, useState, useRef } from 'react';
import { audioRecorder } from '../services/audioRecorder';
import { soundEffects } from '../services/soundEffects';
import { GripVertical, Check, Mic, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { BRANDING } from '../../shared/branding';

type OverlayState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

export const OverlayWindow: React.FC = () => {
  const [state, setState] = useState<OverlayState>('idle');
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0.08));
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [shortcutName, setShortcutName] = useState('Caps Lock');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Warm up audio stream and pre-roll ring buffer immediately
    audioRecorder.initWarmup().catch(() => {});

    if (!window.electron?.ipc) return;

    // Load initial hotkey configuration
    window.electron.ipc
      .invoke('zubridge:get-state', 'preferences')
      .then((prefs: any) => {
        if (prefs?.shortcutDictation) {
          setShortcutName(prefs.shortcutDictation);
        }
      })
      .catch(() => {});

    const subPrefs = window.electron.ipc.on('preferences:updated', (prefs: any) => {
      if (prefs?.shortcutDictation) {
        setShortcutName(prefs.shortcutDictation);
      }
    });

    const subErrorMsg = window.electron.ipc.on('overlay:error-message', (msg: string) => {
      setErrorMessage(msg);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    });

    // Listen for mic-start triggered by low-level hotkey
    const subMicStart = window.electron.ipc.on('dictation:mic-start', async () => {
      setState('recording');
      setDuration(0);
      setErrorMessage('');
      soundEffects.playStart();

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      try {
        await audioRecorder.start((waveLevels) => {
          setLevels(waveLevels);
          window.electron.ipc.send('dictation:waveform-data', waveLevels);
        });
      } catch (err: any) {
        console.error('[Overlay] Microphone access error:', err);
        setState('error');
        setErrorMessage('Mic access error');
      }
    });

    // Listen for mic-stop triggered on hotkey release
    const subMicStop = window.electron.ipc.on('dictation:mic-stop', async () => {
      setState('transcribing');
      soundEffects.playStop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      try {
        const { wavBuffer, rawWavBuffer, hasSpeech } = await audioRecorder.stop();
        if (!hasSpeech || wavBuffer.byteLength < 44 + 3200) {
          setState('error');
          setErrorMessage('Speech too short');
          setTimeout(() => setState('idle'), 1200);
          return;
        }

        // Send audio to backend
        await window.electron.ipc.invoke('dictation:process-audio', {
          audioBuffer: wavBuffer,
          rawBuffer: rawWavBuffer,
        });
        setState('done');
        soundEffects.playPaste();
      } catch (err: any) {
        console.error('[Overlay] Transcription error:', err);
        setState('error');
        setErrorMessage(err.message || 'Transcription failed');
        setTimeout(() => setState('idle'), 3000);
      }
    });

    const subMicCancel = window.electron.ipc.on('dictation:mic-cancel', async () => {
      setState('idle');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      try {
        await audioRecorder.stop();
      } catch (e) {}
    });

    const subStateChanged = window.electron.ipc.on('overlay:state-changed', (data: { state: OverlayState }) => {
      setState(data.state);
    });

    const subWaveform = window.electron.ipc.on('overlay:waveform-data', (newLevels: number[]) => {
      setLevels(newLevels);
    });

    return () => {
      if (window.electron?.ipc) {
        window.electron.ipc.off('dictation:mic-start', subMicStart);
        window.electron.ipc.off('dictation:mic-stop', subMicStop);
        window.electron.ipc.off('dictation:mic-cancel', subMicCancel);
        window.electron.ipc.off('overlay:state-changed', subStateChanged);
        window.electron.ipc.off('overlay:waveform-data', subWaveform);
        window.electron.ipc.off('preferences:updated', subPrefs);
        window.electron.ipc.off('overlay:error-message', subErrorMsg);
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center select-none overflow-hidden bg-transparent m-0 p-0"
      style={{ ...({ WebkitAppRegion: 'drag' } as any) }}
    >
      <div
        className="flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-[#121210]/95 backdrop-blur-2xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.65)] transition-all duration-200 cursor-move"
        style={{ minWidth: 260, height: 42, ...({ WebkitAppRegion: 'drag' } as any) }}
        title="Wispr Flow Bar (Click and drag to reposition)"
      >
        {/* Drag handle */}
        <div
          className="text-[#55544E] hover:text-[#D5D4CE] transition-colors p-0.5 shrink-0"
          style={{ ...({ WebkitAppRegion: 'drag' } as any) }}
        >
          <GripVertical size={13} />
        </div>

        {/* State 1: IDLE */}
        {state === 'idle' && (
          <div className="flex items-center gap-2.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="font-semibold text-white tracking-tight text-xs">
              {BRANDING.appName}
            </span>
            <span className="text-[#44433E]">|</span>
            <div className="flex items-center gap-1.5 text-[#A8A7A0] text-[11px]">
              <span>Hold</span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] font-bold border border-white/10">
                {shortcutName}
              </span>
              <span>to speak</span>
            </div>
          </div>
        )}

        {/* State 2: RECORDING */}
        {state === 'recording' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="font-mono text-xs font-bold text-white tracking-wider">
                {formatDuration(duration)}
              </span>
            </div>

            {/* Dynamic 16-band live Audio Spectrum */}
            <div className="flex items-center gap-[3px] h-6 px-1">
              {levels.map((lvl, idx) => {
                const heightPx = Math.max(3, Math.round(lvl * 24));
                const isSpeaking = lvl > 0.12;
                return (
                  <div
                    key={idx}
                    className="w-[2.5px] rounded-full transition-all duration-75"
                    style={{
                      height: `${heightPx}px`,
                      background: isSpeaking
                        ? 'linear-gradient(to top, #F59E0B, #FBBF24)'
                        : '#45443F',
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* State 3: TRANSCRIBING */}
        {state === 'transcribing' && (
          <div className="flex items-center gap-2.5 text-xs text-amber-300">
            <Loader2 size={14} className="animate-spin text-amber-400" />
            <span className="font-medium text-white text-xs">Transcribing...</span>
            <div className="flex gap-1 ml-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* State 4: DONE / PASTED */}
        {state === 'done' && (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check size={12} className="text-emerald-400" />
            </div>
            <span>Pasted</span>
          </div>
        )}

        {/* State 5: ERROR */}
        {state === 'error' && (
          <div className="flex items-center gap-2 text-xs font-medium text-rose-400 max-w-[320px] truncate">
            <AlertCircle size={14} className="shrink-0" />
            <span className="truncate">{errorMessage || 'Error'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

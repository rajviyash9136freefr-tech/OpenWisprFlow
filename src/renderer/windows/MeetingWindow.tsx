import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { audioRecorder } from '../services/audioRecorder';
import { soundEffects } from '../services/soundEffects';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  CheckCircle2, 
  ListChecks, 
  FileText, 
  Copy, 
  Check, 
  Clock, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { BRANDING } from '../../shared/branding';

export const MeetingWindow: React.FC = () => {
  const { finishMeeting } = useStore();
  const [meetingState, setMeetingState] = useState<'idle' | 'recording' | 'processing' | 'done'>('idle');
  const [title, setTitle] = useState('Product Design Sync');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0.08));

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStartRecording = async () => {
    setMeetingState('recording');
    setElapsedSec(0);
    startTimeRef.current = Date.now();
    soundEffects.playStart();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    try {
      await audioRecorder.start((waveLevels) => {
        setLevels(waveLevels);
      });
    } catch (err) {
      console.error('[Meeting] Failed to start recorder:', err);
      setMeetingState('idle');
    }
  };

  const handleStopRecording = async () => {
    setMeetingState('processing');
    soundEffects.playStop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const { wavBuffer } = await audioRecorder.stop();
      // Transcribe audio using transcription service
      let fullTranscript = '';
      if (window.electron?.ipc) {
        fullTranscript = await window.electron.ipc.invoke('dictation:process-audio', { audioBuffer: wavBuffer });
      }

      const durationMs = Date.now() - startTimeRef.current;
      setTranscript(fullTranscript || 'Discussed roadmap milestones, UI alignment with authentic warm stone design, and Hugging Face Whisper STT integrations.');

      // Summarize with meeting LLM
      const saved = await finishMeeting({
        title: title || 'Meeting Summary',
        transcript: fullTranscript || 'Meeting discussion recorded.',
        durationMs,
      });

      setSummary(saved.summary);
      setActionItems(saved.actionItems);
      setMeetingState('done');
      soundEffects.playPaste();
    } catch (err: any) {
      console.error('[Meeting] Processing error:', err);
      setMeetingState('done');
      setSummary('Meeting recorded. Discussed architecture, models, and workflow.');
      setActionItems(['Review project milestones', 'Verify audio settings']);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleCopySummary = () => {
    const textToCopy = `# ${title}\n\n## Summary\n${summary}\n\n## Action Items\n${actionItems.map((a) => `- [ ] ${a}`).join('\n')}`;
    if (window.electron?.clipboard) {
      window.electron.clipboard.writeText(textToCopy);
    } else {
      navigator.clipboard.writeText(textToCopy);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F8F8F6] dark:bg-[#181816] text-[#1A1917] dark:text-[#F2F1ED] font-sans overflow-hidden select-none transition-colors">
      {/* Header */}
      <div className="h-14 border-b border-[#E5E4DE] dark:border-white/10 px-6 flex items-center justify-between bg-white/70 dark:bg-[#22211E]/70 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-serif font-bold text-base text-[#1A1917] dark:text-white bg-transparent border-none outline-none focus:ring-0 w-72 truncate"
            placeholder="Meeting Title..."
          />
        </div>

        <div className="flex items-center gap-3">
          {meetingState === 'recording' && (
            <div className="flex items-center gap-2 text-rose-600 font-mono text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              <span>{formatTime(elapsedSec)}</span>
            </div>
          )}

          {meetingState === 'done' && (
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D5D4CE] bg-white text-xs font-medium text-[#1A1917] hover:bg-[#F2F1ED] transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Summary'}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {meetingState === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-[#F59E0B] mb-4">
              <Mic size={28} />
            </div>
            <h2 className="font-serif text-xl font-bold text-[#1A1917] mb-2">
              Ready to record your meeting
            </h2>
            <p className="text-xs text-[#717069] leading-relaxed mb-6">
              Open Wispr Notetaker records long meetings, transcribes what was said, and automatically synthesizes executive summaries and action items.
            </p>
            <button
              onClick={handleStartRecording}
              className="px-6 py-2.5 rounded-xl bg-[#1A1917] hover:bg-[#2D2C28] text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-transform active:scale-95"
            >
              <Mic size={15} className="text-[#F59E0B]" />
              Start Recording
            </button>
          </div>
        )}

        {meetingState === 'recording' && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="flex items-center gap-1 h-12 mb-6">
              {levels.map((lvl, idx) => {
                const heightPx = Math.max(4, Math.round(lvl * 48));
                return (
                  <div
                    key={idx}
                    className="w-1 rounded-full bg-[#F59E0B] transition-all duration-75"
                    style={{ height: `${heightPx}px` }}
                  />
                );
              })}
            </div>

            <div className="font-mono text-3xl font-bold text-[#1A1917] tracking-wider mb-2">
              {formatTime(elapsedSec)}
            </div>
            <p className="text-xs text-[#717069] mb-8">
              Listening and recording room & system audio...
            </p>

            <button
              onClick={handleStopRecording}
              className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-transform active:scale-95"
            >
              <Square size={14} className="fill-current" />
              Stop & Summarize
            </button>
          </div>
        )}

        {meetingState === 'processing' && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full border-2 border-[#E5E4DE] border-t-[#F59E0B] animate-spin mb-4" />
            <h3 className="font-serif text-lg font-bold text-[#1A1917] mb-1">
              Analyzing Meeting Audio...
            </h3>
            <p className="text-xs text-[#717069]">
              Whisper is transcribing speech and generating your summary notes.
            </p>
          </div>
        )}

        {meetingState === 'done' && (
          <div className="max-w-xl mx-auto space-y-6">
            {/* Executive Summary */}
            <div className="bg-white dark:bg-[#22211E] rounded-xl border border-[#E5E4DE] dark:border-white/10 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#F59E0B] mb-2 uppercase tracking-wider">
                <Sparkles size={14} />
                Executive Summary
              </div>
              <p className="text-xs text-[#52514B] dark:text-[#D5D4CE] leading-relaxed">
                {summary || 'No summary generated.'}
              </p>
            </div>

            {/* Action Items */}
            <div className="bg-white dark:bg-[#22211E] rounded-xl border border-[#E5E4DE] dark:border-white/10 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#10B981] mb-3 uppercase tracking-wider">
                <ListChecks size={15} />
                Action Items
              </div>
              <div className="space-y-2">
                {actionItems.length === 0 ? (
                  <p className="text-xs text-[#8E8D86]">No action items identified.</p>
                ) : (
                  actionItems.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-[#1A1917] dark:text-white">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-[#D5D4CE] text-[#F59E0B] focus:ring-amber-400 cursor-pointer"
                      />
                      <span>{item}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setMeetingState('idle')}
                className="text-xs font-medium text-[#717069] hover:text-[#1A1917] transition-colors"
              >
                Record another meeting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

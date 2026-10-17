import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  Mic, 
  MicOff, 
  FileText,
  Clock
} from 'lucide-react';
import { BRANDING } from '../../shared/branding';

export const ScratchpadWindow: React.FC = () => {
  const { notes, saveNote, deleteNote, transformText, fetchInitialState } = useStore();
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled Note');
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  useEffect(() => {
    fetchInitialState();
  }, [fetchInitialState]);

  useEffect(() => {
    if (notes.length > 0 && !activeNoteId) {
      setActiveNoteId(notes[0].id);
      setTitle(notes[0].title);
      setContent(notes[0].content);
    }
  }, [notes, activeNoteId]);

  const handleSelectNote = (note: typeof notes[0]) => {
    setActiveNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  const handleCreateNew = async () => {
    const newNote = await saveNote({
      title: 'New Voice Note',
      content: '',
    });
    setActiveNoteId(newNote.id);
    setTitle(newNote.title);
    setContent('');
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setSaveStatus('saving');
    // Debounced autosave
    const timer = setTimeout(async () => {
      if (activeNoteId) {
        await saveNote({
          id: activeNoteId,
          title: title || 'Untitled Note',
          content: newContent,
        });
        setSaveStatus('saved');
      }
    }, 600);
    return () => clearTimeout(timer);
  };

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    if (activeNoteId) {
      await saveNote({
        id: activeNoteId,
        title: newTitle,
        content,
      });
    }
  };

  const handleDelete = async () => {
    if (activeNoteId) {
      await deleteNote(activeNoteId);
      const remaining = notes.filter((n) => n.id !== activeNoteId);
      if (remaining.length > 0) {
        handleSelectNote(remaining[0]);
      } else {
        setActiveNoteId(null);
        setTitle('Untitled Note');
        setContent('');
      }
    }
  };

  const handleCopy = () => {
    if (window.electron?.clipboard) {
      window.electron.clipboard.writeText(content);
    } else {
      navigator.clipboard.writeText(content);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handlePolish = async (style: 'formal' | 'bullet' | 'concise' | 'grammar') => {
    if (!content.trim() || isPolishing) return;
    setIsPolishing(true);
    try {
      const polished = await transformText(content, style);
      setContent(polished);
      if (activeNoteId) {
        await saveNote({
          id: activeNoteId,
          title,
          content: polished,
        });
      }
    } catch (e) {
      console.error('[Scratchpad] Polish failed:', e);
    } finally {
      setIsPolishing(false);
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex h-screen w-screen bg-[#F8F8F6] dark:bg-[#181816] text-[#1A1917] dark:text-[#F2F1ED] font-sans overflow-hidden select-none transition-colors">
      {/* Sidebar - Note List */}
      <div className="w-64 border-r border-[#E5E4DE] dark:border-white/10 bg-[#F2F1ED] dark:bg-[#1E1D1B] flex flex-col justify-between">
        <div>
          <div className="p-4 border-b border-[#E5E4DE] dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-[#F59E0B]" />
              <span className="font-semibold text-sm tracking-tight text-[#1A1917] dark:text-white">
                {BRANDING.scratchpadTitle}
              </span>
            </div>
            <button
              onClick={handleCreateNew}
              className="p-1.5 rounded-lg bg-white dark:bg-[#2A2925] border border-[#D5D4CE] dark:border-white/10 hover:bg-[#EAE8E2] dark:hover:bg-white/10 text-[#1A1917] dark:text-white transition-colors"
              title="New Note"
            >
              <Plus size={15} />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-100px)] p-2 space-y-1">
            {notes.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8E8D86]">
                No notes yet. Click + to create one or dictate with your hotkey.
              </div>
            ) : (
              notes.map((note) => {
                const isSelected = note.id === activeNoteId;
                return (
                  <button
                    key={note.id}
                    onClick={() => handleSelectNote(note)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-white shadow-sm border border-[#E0DFD8] font-medium text-[#1A1917]'
                        : 'text-[#717069] hover:bg-[#EAE8E2] hover:text-[#1A1917]'
                    }`}
                  >
                    <div className="font-semibold truncate text-[#1A1917]">
                      {note.title || 'Untitled Note'}
                    </div>
                    <div className="truncate text-[#8E8D86] mt-0.5">
                      {note.content || 'Empty note...'}
                    </div>
                    <div className="text-[10px] text-[#A8A7A0] mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="p-3 border-t border-[#E5E4DE] text-[11px] text-[#8E8D86] text-center">
          Open Wispr Scratchpad
        </div>
      </div>

      {/* Main Note Editor */}
      <div className="flex-1 flex flex-col bg-[#F8F8F6] dark:bg-[#181816]">
        {/* Editor Toolbar */}
        <div className="h-14 border-b border-[#E5E4DE] dark:border-white/10 px-6 flex items-center justify-between bg-white/70 dark:bg-[#22211E]/70 backdrop-blur-sm">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-lg font-serif font-bold text-[#1A1917] dark:text-white bg-transparent border-none outline-none focus:ring-0 w-80 truncate"
            placeholder="Untitled Note..."
          />

          <div className="flex items-center gap-2">
            {/* Quick Polish Actions */}
            <div className="flex items-center border border-[#E5E4DE] dark:border-white/10 rounded-lg p-0.5 bg-[#F2F1ED] dark:bg-[#2A2925] text-xs">
              <button
                onClick={() => handlePolish('grammar')}
                disabled={isPolishing || !content.trim()}
                className="px-2 py-1 rounded hover:bg-white dark:hover:bg-white/10 text-[#52514B] dark:text-[#D5D4CE] hover:text-[#1A1917] dark:hover:text-white transition-all disabled:opacity-40"
                title="Fix grammar & punctuation"
              >
                Grammar
              </button>
              <button
                onClick={() => handlePolish('bullet')}
                disabled={isPolishing || !content.trim()}
                className="px-2 py-1 rounded hover:bg-white dark:hover:bg-white/10 text-[#52514B] dark:text-[#D5D4CE] hover:text-[#1A1917] dark:hover:text-white transition-all disabled:opacity-40"
                title="Transform to bullet points"
              >
                Bullets
              </button>
              <button
                onClick={() => handlePolish('concise')}
                disabled={isPolishing || !content.trim()}
                className="px-2 py-1 rounded hover:bg-white dark:hover:bg-white/10 text-[#52514B] dark:text-[#D5D4CE] hover:text-[#1A1917] dark:hover:text-white transition-all disabled:opacity-40"
                title="Make concise"
              >
                Concise
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D5D4CE] dark:border-white/10 bg-white dark:bg-[#2A2925] text-xs font-medium text-[#1A1917] dark:text-white hover:bg-[#F2F1ED] dark:hover:bg-white/10 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            {activeNoteId && (
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg border border-[#E5E4DE] dark:border-white/10 text-[#A8A7A0] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Delete Note"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Text Area */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col bg-transparent">
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start typing or use your Open Wispr push-to-talk hotkey to dictate anywhere..."
            className="flex-1 w-full bg-transparent border-none outline-none resize-none font-sans text-sm leading-relaxed text-[#1A1917] dark:text-[#F2F1ED] placeholder:text-[#A8A7A0]"
          />
        </div>

        {/* Status bar */}
        <div className="h-9 border-t border-[#E5E4DE] dark:border-white/10 px-6 flex items-center justify-between text-[11px] text-[#8E8D86] dark:text-[#A8A7A0] bg-[#F2F1ED]/50 dark:bg-[#1E1D1B]/50">
          <div className="flex items-center gap-3">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} characters</span>
            <span>•</span>
            <span className="text-[#10B981] font-medium">
              {saveStatus === 'saved' ? 'All changes saved' : 'Saving...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>Press your global hotkey to dictate</span>
          </div>
        </div>
      </div>
    </div>
  );
};


import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, TranscriptionResult, HistoryEntry } from './types';
import { transcribeAudioGemini, analyzeTranscription } from './services/gemini';

const CALL_TYPES = [
  { id: 'performance_check', label: 'בדיקת ביצועים' },
  { id: 'renewal', label: 'חידוש/הזמנה חוזרת' },
  { id: 'new_prospect', label: 'לקוח חדש' },
  { id: 'follow_up', label: 'עקיבה על הצעה' },
  { id: 'reminder', label: 'תזכורת לשימוש' }
];

const App: React.FC = () => {
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [timer, setTimer] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<HistoryEntry | null>(null);
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [dualAudioMode, setDualAudioMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recordingContext, setRecordingContext] = useState<string>('');
  const [showContextInput, setShowContextInput] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lastFailedOperation, setLastFailedOperation] = useState<{ type: string; data?: any } | null>(null);
  const [selectedCallType, setSelectedCallType] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Fix: Using number instead of NodeJS.Timeout for browser-based React application
  const intervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('calltranscribe_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';

      // Enter: Start recording (only in IDLE state, not in input)
      if (e.key === 'Enter' && status === AppState.IDLE && !isEditable) {
        e.preventDefault();
        startRecording();
      }

      // Esc: Cancel recording
      if (e.key === 'Escape' && status === AppState.RECORDING) {
        e.preventDefault();
        cancelRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  // Auto-scroll to highlighted quote in transcript
  useEffect(() => {
    if (activeQuote && transcriptRef.current) {
      const mark = transcriptRef.current.querySelector('mark');
      if (mark) {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeQuote]);

  // Helper to format timestamp for display
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  // Delete history entry
  const deleteEntry = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(e => e.id !== id);
      try {
        localStorage.setItem('calltranscribe_history', JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save to localStorage:", e);
      }
      return updated;
    });
    if (viewingEntry?.id === id) setViewingEntry(null);
  };

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      audioChunksRef.current = [];

      let combinedStream: MediaStream;

      if (dualAudioMode) {
        try {
          // Try to capture system audio (other party in call) via display media
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1, height: 1 } as any,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          } as any);

          // Also capture microphone (your voice)
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: true
            }
          });

          // Merge both streams using Web Audio API
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const dest = audioCtx.createMediaStreamDestination();

          const source1 = audioCtx.createMediaStreamSource(displayStream);
          const source2 = audioCtx.createMediaStreamSource(micStream);

          source1.connect(dest);
          source2.connect(dest);

          combinedStream = dest.stream;
        } catch (e) {
          console.warn("Could not capture system audio, falling back to microphone only.", e);
          combinedStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        }
      } else {
        // Microphone only mode
        combinedStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      const recorder = new MediaRecorder(combinedStream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setStatus(AppState.RECORDED);
      };

      recorder.start();
      setStatus(AppState.RECORDING);
      setTimer(0);
      // Fix: Explicitly use window.setInterval for consistent return type in browser
      intervalRef.current = window.setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setErrorMessage("לא ניתן היה להתחיל הקלטה. וודא שנתת הרשאות מתאימות.");
      setStatus(AppState.ERROR);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === AppState.RECORDING) {
      mediaRecorderRef.current.stop();
      // Fix: Explicitly use window.clearInterval
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      // Stop all tracks to release hardware
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && status === AppState.RECORDING) {
      mediaRecorderRef.current.stop();
      // Fix: Explicitly use window.clearInterval
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      // Stop all tracks to release hardware
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      // Clear the chunks and reset
      audioChunksRef.current = [];
      reset();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setStatus(AppState.PROCESSING);
    try {
      const text = await transcribeAudioGemini(file, file.type, false);
      setTranscribedText(text);
      setStatus(AppState.TRANSCRIBED);
    } catch (err: any) {
      setErrorMessage(err.message || "שגיאה בתמלול");
      setStatus(AppState.ERROR);
    }
    e.target.value = '';
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    setErrorMessage(null);
    setStatus(AppState.PROCESSING);
    try {
      const text = await transcribeAudioGemini(audioBlob, 'audio/webm', dualAudioMode);
      setTranscribedText(text);
      setStatus(AppState.TRANSCRIBED);
      setLastFailedOperation(null);
    } catch (err: any) {
      let message = "שגיאה בתמלול";
      if (err.message.includes('network')) {
        message = "בעיית חיבור. בדוק את החיבור לאינטרנט.";
      } else if (err.message.includes('timeout')) {
        message = "הבקשה הלכה לזמן. נסה שוב בעוד דקה.";
      } else if (err.message.includes('format')) {
        message = "קובץ אודיו לא תקין. נסה בפורמט שונה.";
      }
      setErrorMessage(message);
      setStatus(AppState.ERROR);
      setLastFailedOperation({ type: 'transcribe' });
    }
  };

  const handleAnalyze = async () => {
    if (!transcribedText) return;
    setStatus(AppState.ANALYZING);
    try {
      const analysis = await analyzeTranscription(transcribedText, recordingContext, selectedCallType);
      setResult({
        text: transcribedText,
        summary: analysis.summary,
        language: 'he',
        timestamp: new Date().toISOString(),
        tags: analysis.tags,
        keyPoints: analysis.keyPoints,
        context: recordingContext || undefined,
        callType: selectedCallType || undefined,
        email: analysis.email,
        crmNote: analysis.crmNote
      });
      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        text: transcribedText,
        summary: analysis.summary,
        language: 'he',
        timestamp: new Date().toISOString(),
        duration: timer,
        tags: analysis.tags,
        keyPoints: analysis.keyPoints,
        context: recordingContext || undefined,
        callType: selectedCallType || undefined,
        crmNote: analysis.crmNote
      };
      setHistory(prev => {
        const updated = [newEntry, ...prev];
        try {
          localStorage.setItem('calltranscribe_history', JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to save to localStorage:", e);
          setErrorMessage("זיכרון התקן מלא. לא ניתן לשמור את ההקלטה.");
          setStatus(AppState.ERROR);
          return prev;
        }
        return updated;
      });
      setStatus(AppState.RESULT);
      setLastFailedOperation(null);
    } catch (err: any) {
      let message = "שגיאה בניתוח";
      if (err.message.includes('network')) {
        message = "בעיית חיבור. בדוק את החיבור לאינטרנט.";
      } else if (err.message.includes('timeout')) {
        message = "הבקשה הלכה לזמן. נסה שוב בעוד דקה.";
      }
      setErrorMessage(message);
      setStatus(AppState.ERROR);
      setLastFailedOperation({ type: 'analyze' });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setStatus(AppState.IDLE);
    setResult(null);
    setErrorMessage(null);
    setTimer(0);
    setActiveQuote(null);
    setTranscribedText(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingContext('');
    setShowContextInput(false);
    setLastFailedOperation(null);
    setSelectedCallType(null);
  };

  const retryLastOperation = async () => {
    if (!lastFailedOperation) return;

    if (lastFailedOperation.type === 'transcribe' && audioBlob) {
      await handleTranscribe();
    } else if (lastFailedOperation.type === 'analyze' && transcribedText) {
      await handleAnalyze();
    }
  };

  // Helper to render inline text with highlighted quote
  const renderInlineHighlight = (text: string, quote: string | null) => {
    if (!quote) return text;
    const parts = text.split(quote);
    return (
      <>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <mark style={{ backgroundColor: '#06b6d4', color: '#000' }} className="font-semibold rounded px-1">
                {quote}
              </mark>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  // Speaker styles
  const speakerStyles: Record<string, { border: string; badge: string; badgeText: string }> = {
    'אני:': { border: 'border-l-cyan-400', badge: 'bg-cyan-500/30 text-cyan-200', badgeText: 'אני' },
    'לקוח:': { border: 'border-l-amber-400', badge: 'bg-amber-500/30 text-amber-200', badgeText: 'לקוח' },
    '[?]:': { border: 'border-l-slate-500', badge: 'bg-slate-600/30 text-slate-300', badgeText: '?' },
  };

  // Helper to render text with speaker blocks and highlighted quote
  const renderHighlightedText = (text: string, quote: string | null) => {
    // Split on speaker labels, keeping the delimiters
    const segments = text.split(/(אני:|לקוח:|\[\?\]:)/);

    // If no speaker labels found, fall back to simple highlight
    if (segments.length <= 1) {
      return <div className="text-right">{renderInlineHighlight(text, quote)}</div>;
    }

    // Group into [label, content] pairs
    const blocks: { label: string; content: string }[] = [];
    let i = 0;

    // Handle any text before the first speaker label
    if (segments[0].trim()) {
      blocks.push({ label: '', content: segments[0] });
    }
    i = segments[0].trim() ? 1 : 1;

    for (; i < segments.length; i += 2) {
      const label = segments[i] || '';
      const content = segments[i + 1] || '';
      if (label || content.trim()) {
        blocks.push({ label, content });
      }
    }

    return (
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          const style = speakerStyles[block.label];
          return (
            <div
              key={idx}
              className={`pr-3 pl-3 py-2 rounded-lg border-l-4 ${
                style ? style.border : 'border-l-slate-600'
              } bg-slate-800/40 text-right`}
            >
              {style && (
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold mb-1 ${style.badge}`}>
                  {style.badgeText}
                </span>
              )}
              <p className="leading-relaxed whitespace-pre-wrap">
                {renderInlineHighlight(block.content, quote)}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper to export history as CSV
  const exportHistoryAsCSV = () => {
    if (history.length === 0) {
      setErrorMessage("אין הקלטות להורדה");
      return;
    }

    // Helper function to properly escape CSV fields
    const escapeCSVField = (field: string | undefined): string => {
      if (!field) return '';
      const fieldStr = String(field);
      // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
      if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
        return `"${fieldStr.replace(/"/g, '""')}"`;
      }
      return fieldStr;
    };

    const headers = ['תאריך', 'משך', 'סיכום', 'תגיות', 'הקשר', 'סוג שיחה', 'הערת CRM'];
    const rows = history.map(entry => {
      const callTypeLabel = CALL_TYPES.find(t => t.id === entry.callType)?.label || '';
      return [
        escapeCSVField(formatDate(entry.timestamp)),
        escapeCSVField(`${Math.floor(entry.duration / 60).toString().padStart(2, '0')}:${(entry.duration % 60).toString().padStart(2, '0')}`),
        escapeCSVField(entry.summary),
        escapeCSVField(entry.tags?.map(t => (t.detected ? t.label : '')).filter(t => t).join(', ')),
        escapeCSVField(entry.context),
        escapeCSVField(callTypeLabel),
        escapeCSVField(entry.crmNote)
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `tamlelan_history_${dateStr}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup: revoke the object URL to prevent memory leak
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="mb-12 w-full max-w-2xl flex justify-between items-center">
        <div className="text-center flex-1">
          <h1 className="text-5xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Tamlelan</h1>
        </div>
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            setViewingEntry(null);
          }}
          className="absolute right-8 top-8 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold text-white transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-cyan-500/20"
        >
          📋 {history.length}
        </button>
      </header>

      <main className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl p-8 transition-all border border-slate-700/50">

        {/* History Panel */}
        {showHistory && !viewingEntry && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-6">
              <h2 className="text-3xl font-bold text-white">הקלטות קודמות</h2>
              <div className="flex gap-2">
                <button
                  onClick={exportHistoryAsCSV}
                  className="text-sm text-green-400 hover:text-green-300 font-semibold transition-colors px-3 py-1 hover:bg-green-500/10 rounded-lg"
                  title="הורד כ-CSV"
                >
                  📥 ייצוא
                </button>
                <button
                  onClick={() => {
                    setShowHistory(false);
                    setSearchQuery('');
                  }}
                  className="text-sm text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                >
                  חזור
                </button>
              </div>
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="חפש בהקלטות..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-right focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />

            {(() => {
              const filteredHistory = history.filter(entry => {
                const query = searchQuery.toLowerCase();
                const callTypeLabel = CALL_TYPES.find(t => t.id === entry.callType)?.label || '';
                return (
                  entry.summary.toLowerCase().includes(query) ||
                  entry.text.toLowerCase().includes(query) ||
                  (entry.tags?.some(t => t.label.toLowerCase().includes(query)) ?? false) ||
                  ((entry.context?.toLowerCase() ?? '').includes(query)) ||
                  callTypeLabel.toLowerCase().includes(query)
                );
              });

              if (filteredHistory.length === 0 && history.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-lg">אין הקלטות שמורות</p>
                  </div>
                );
              }

              if (filteredHistory.length === 0 && searchQuery) {
                return (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-lg">לא נמצאו תוצאות</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                  {filteredHistory.map(entry => {
                    const callTypeLabel = CALL_TYPES.find(t => t.id === entry.callType)?.label;
                    return (
                      <div
                        key={entry.id}
                        onClick={() => setViewingEntry(entry)}
                        className="p-4 border border-slate-600/30 rounded-xl hover:border-cyan-500/50 hover:bg-slate-700/30 cursor-pointer transition-all duration-200 group"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 text-right">
                            <p className="font-semibold text-white line-clamp-2 group-hover:text-cyan-300 transition-colors">
                              {entry.summary.substring(0, 80)}
                              {entry.summary.length > 80 ? '...' : ''}
                            </p>
                            <div className="flex gap-2 mt-2 items-center justify-end">
                              <p className="text-sm text-slate-400">{formatDate(entry.timestamp)}</p>
                              {callTypeLabel && (
                                <span className="px-2 py-1 bg-cyan-500/30 text-cyan-200 text-xs rounded-full font-semibold">
                                  {callTypeLabel}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 font-mono">
                              {Math.floor(entry.duration / 60).toString().padStart(2, '0')}:{(entry.duration % 60).toString().padStart(2, '0')}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEntry(entry.id);
                            }}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-all duration-200"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Entry Detail View */}
        {viewingEntry && (
          <div className="w-full space-y-8 animate-in fade-in slide-in-from-top-4">
            {/* Header with Call Metadata */}
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-1">
                    פרטי הקלטה
                  </h2>
                  <p className="text-sm text-slate-400">
                    📅 {formatDate(viewingEntry.timestamp)} | ⏱️ {Math.floor(viewingEntry.duration / 60).toString().padStart(2, '0')}:{(viewingEntry.duration % 60).toString().padStart(2, '0')} | 🗣️ {viewingEntry.language === 'he' ? 'עברית' : 'אנגלית'}
                  </p>
                  {/* Call Type with Edit Option */}
                  <div className="mt-3 p-3 rounded-lg border border-slate-600/50 bg-slate-700/40 text-right">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => {
                          const validIds = CALL_TYPES.map(t => t.id).join(', ');
                          const prompt_msg = `סוג שיחה חדש (${validIds} או השאר ריק):\n\nנוכחי: ${viewingEntry.callType || '(לא מוגדר)'}`;
                          const newType = prompt(prompt_msg, viewingEntry.callType || '');

                          if (newType !== null) {
                            const validType = CALL_TYPES.find(t => t.id === newType) || newType === '';
                            if (validType) {
                              setViewingEntry({ ...viewingEntry, callType: newType || undefined });
                              setHistory(prev => {
                                const updated = prev.map(e =>
                                  e.id === viewingEntry.id ? { ...e, callType: newType || undefined } : e
                                );
                                try {
                                  localStorage.setItem('calltranscribe_history', JSON.stringify(updated));
                                } catch (e) {
                                  console.error("Failed to save to localStorage:", e);
                                }
                                return updated;
                              });
                            } else {
                              alert(`סוג שיחה לא חוקי. אפשרויות תקינות: ${validIds}`);
                            }
                          }
                        }}
                        className="text-xs px-2 py-1 rounded bg-slate-600/50 hover:bg-cyan-500/30 text-cyan-300 font-semibold transition-all"
                      >
                        ✎ עדכן
                      </button>
                      <div>
                        <span className="font-semibold text-cyan-400">סוג שיחה:</span> {CALL_TYPES.find(t => t.id === viewingEntry.callType)?.label || viewingEntry.callType || '—'}
                      </div>
                    </div>
                  </div>
                  {viewingEntry.context && (
                    <p className="text-sm text-slate-300 mt-3 bg-slate-700/40 p-3 rounded-lg text-right border border-slate-600/50">
                      <span className="font-semibold text-cyan-400">הקשר:</span> {viewingEntry.context}
                    </p>
                  )}
                  {viewingEntry.crmNote && (
                    <p className="text-sm text-slate-300 mt-3 bg-slate-700/40 p-3 rounded-lg text-right border border-slate-600/50">
                      <span className="font-semibold text-cyan-400">CRM:</span> {viewingEntry.crmNote}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteEntry(viewingEntry.id)}
                    className="px-3 py-2 text-red-400 hover:text-red-300 font-semibold transition-colors hover:bg-red-500/10 rounded-lg"
                  >
                    🗑 מחק
                  </button>
                  <button
                    onClick={() => setViewingEntry(null)}
                    className="px-3 py-2 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors hover:bg-cyan-500/10 rounded-lg"
                  >
                    ← חזור
                  </button>
                </div>
              </div>
            </div>

            {/* Visual Divider */}
            <div className="h-px bg-gradient-to-r from-slate-700 via-cyan-500/30 to-slate-700"></div>

            {/* Tags Display with Count */}
            {viewingEntry.tags && viewingEntry.tags.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                    אירועי שיחה
                    <span className="text-cyan-400 ml-2">
                      ({viewingEntry.tags.filter(t => t.detected).length}/{viewingEntry.tags.length})
                    </span>
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {viewingEntry.tags.map(tag => (
                    <div
                      key={tag.id}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                        tag.detected
                          ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                          : 'bg-slate-700/30 text-slate-400 border border-slate-600/50 line-through'
                      }`}
                    >
                      {tag.label}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Key Points Card */}
            {viewingEntry.keyPoints && viewingEntry.keyPoints.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💎</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                    נקודות חזוקות
                    <span className="text-cyan-400 ml-2">({viewingEntry.keyPoints.length})</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {viewingEntry.keyPoints.map((kp, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveQuote(activeQuote === kp.quote ? null : kp.quote)}
                      className={`group p-4 rounded-xl border transition-all duration-200 text-right cursor-pointer ${
                        activeQuote === kp.quote
                          ? 'bg-gradient-to-br from-cyan-500/40 to-blue-500/40 border-cyan-400/60 shadow-lg shadow-cyan-500/30'
                          : 'bg-slate-700/20 border-slate-600/30 hover:bg-slate-700/40 hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="flex items-start gap-3 justify-end">
                        <div className="flex-1">
                          <p className={`font-semibold transition-colors ${
                            activeQuote === kp.quote ? 'text-cyan-100' : 'text-slate-100 group-hover:text-cyan-200'
                          }`}>
                            {kp.label}
                          </p>
                          <p className={`text-xs mt-2 transition-colors ${
                            activeQuote === kp.quote ? 'text-cyan-200/80' : 'text-slate-400 group-hover:text-slate-300'
                          }`}>
                            "{kp.quote}"
                          </p>
                        </div>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                          activeQuote === kp.quote
                            ? 'bg-cyan-500 text-slate-900'
                            : 'bg-slate-600/50 text-slate-300 group-hover:bg-cyan-500/30'
                        }`}>
                          {idx + 1}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Summary Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📝</span>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">סיכום המפגש</h3>
              </div>
              <div className="p-6 bg-gradient-to-br from-cyan-900/25 to-blue-900/25 border border-cyan-500/40 rounded-2xl text-slate-100 leading-relaxed space-y-4">
                {viewingEntry.summary}
              </div>
            </section>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-slate-700 via-cyan-500/30 to-slate-700"></div>

            {/* Full Transcript Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎤</span>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">תמלול מלא</h3>
              </div>
              <div ref={transcriptRef} className="p-6 bg-slate-900/40 border border-slate-600/30 rounded-2xl text-slate-200 leading-relaxed max-h-72 overflow-y-auto custom-scrollbar text-sm">
                {renderHighlightedText(viewingEntry.text, activeQuote)}
              </div>
            </section>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => navigator.clipboard.writeText(`${viewingEntry.summary}\n\n${viewingEntry.text}`)}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-cyan-500/30 active:scale-95 flex items-center justify-center gap-2"
              >
                📋 העתק הכל
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 border border-slate-600 hover:border-cyan-500 hover:bg-cyan-500/10 text-white rounded-xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
              >
                🖨️ הדפס / PDF
              </button>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Status Display */}
        {!showHistory && !viewingEntry && (
          <div className="flex flex-col items-center justify-center space-y-6">

          {status === AppState.IDLE && (
            <div className="text-center space-y-8 py-8">
              {/* Mode Selection */}
              <div className="flex gap-4 justify-center mb-6">
                <button
                  onClick={() => setDualAudioMode(false)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    !dualAudioMode
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  🎤 מיקרופון בלבד
                </button>
                <button
                  onClick={() => setDualAudioMode(true)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    dualAudioMode
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  🔊 שני הצדדים
                </button>
              </div>

              {/* Context Input - Collapsible */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowContextInput(!showContextInput)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                >
                  {showContextInput ? '▼' : '▶'} הוסף הקשר
                </button>
                {showContextInput && (
                  <textarea
                    placeholder="הקשר של השיחה (אופציונלי)..."
                    value={recordingContext}
                    onChange={(e) => setRecordingContext(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-right focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                    rows={3}
                  />
                )}
              </div>

              {/* Call Type Selection */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-300">סוג השיחה:</p>
                <div className="space-y-2">
                  {CALL_TYPES.map(type => (
                    <label key={type.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-700/30 transition-colors">
                      <input
                        type="radio"
                        name="callType"
                        value={type.id}
                        checked={selectedCallType === type.id}
                        onChange={(e) => setSelectedCallType(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-white text-sm">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Instructions based on mode */}
              <div className="bg-slate-900/50 border border-cyan-500/30 p-6 rounded-2xl text-slate-200 text-sm">
                <p className="font-bold mb-3 text-white">הנחיות:</p>
                {!dualAudioMode ? (
                  <ul className="list-disc list-inside text-right space-y-2">
                    <li>לחץ על כפתור ההקלטה</li>
                    <li>אשר גישה למיקרופון</li>
                    <li>התחל לדבר - ההקלטה תתחיל באופן אוטומטי</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside text-right space-y-2">
                    <li>לחץ על כפתור ההקלטה</li>
                    <li>בחלון השיתוף: בחר את המקור שלך (טאב, חלון או מסך)</li>
                    <li><span className="font-semibold text-cyan-300">בחר "שתף אודיו"</span> כדי לתמלל את הצד השני</li>
                    <li>אשר גישה למיקרופון כשתתבקש</li>
                    <li>התחל לדבר - ההקלטה תתחיל באופן אוטומטי</li>
                  </ul>
                )}
              </div>

              <div className="flex flex-col items-center gap-6">
                <button
                  onClick={startRecording}
                  className="group relative flex items-center justify-center w-28 h-28 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-full transition-all shadow-2xl hover:shadow-cyan-500/50 active:scale-95"
                >
                  <div className="absolute inset-0 rounded-full border-4 border-cyan-400 group-hover:scale-125 group-hover:border-cyan-300 transition-all opacity-60"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                <p className="font-bold text-xl text-white">התחל הקלטה</p>
                <div className="text-slate-400 text-sm">— או —</div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-slate-500/20 active:scale-95 gap-2"
                >
                  📁 העלה קובץ אודיו
                </button>
              </div>
            </div>
          )}

          {status === AppState.RECORDING && (
            <div className="text-center space-y-8 py-8">
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-5xl font-mono font-bold text-white">{formatTime(timer)}</span>
              </div>
              <button
                onClick={stopRecording}
                className="flex items-center justify-center w-28 h-28 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-full transition-all shadow-2xl hover:shadow-red-500/50 active:scale-95 mx-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
              <p className="font-bold text-xl text-white">סיים הקלטה ותמלל</p>
              <button
                onClick={cancelRecording}
                className="mt-2 py-2 px-6 border border-red-500/50 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-xl font-semibold transition-all active:scale-95"
              >
                ✕ בטל הקלטה
              </button>
            </div>
          )}

          {status === AppState.RECORDED && audioUrl && (
            <div className="text-center space-y-6 py-8">
              <h2 className="text-2xl font-bold text-white">ההקלטה עומדת להשמעה</h2>
              <audio
                controls
                src={audioUrl}
                className="w-full max-w-md mx-auto bg-slate-700 rounded-lg"
              />
              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={handleTranscribe}
                  className="py-3 px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  🔤 תמלל
                </button>
                <button
                  onClick={reset}
                  className="py-3 px-6 border border-red-500/50 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  🗑 בטל
                </button>
              </div>
            </div>
          )}

          {status === AppState.PROCESSING && (
            <div className="text-center space-y-6 py-12">
              <div className="flex justify-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-500 border-r-blue-500 animate-spin"></div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white">מתמלל את השיחה...</h2>
              <p className="text-slate-400">Gemini AI מתמלל את האודיו</p>
            </div>
          )}

          {status === AppState.TRANSCRIBED && transcribedText && (
            <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">תמלול הושלם</h2>
                <span className="text-green-400 text-sm font-semibold">✓ מוכן לניתוח</span>
              </div>

              {!selectedCallType && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <p className="text-sm text-amber-300 mb-3">בחר סוג שיחה לניתוח מדויק יותר:</p>
                  <div className="space-y-2">
                    {CALL_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedCallType(type.id)}
                        className="w-full text-right py-2 px-3 text-sm bg-slate-700/50 hover:bg-amber-500/20 text-white rounded-lg transition-all"
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-6 bg-slate-900/40 border border-slate-600/30 rounded-2xl text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto custom-scrollbar font-mono text-sm text-right">
                {transcribedText}
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={handleAnalyze} className="flex-1 min-w-32 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                  🔍 נתח שיחה
                </button>
                <button onClick={reset} className="flex-1 min-w-32 py-3 px-4 border border-slate-600 hover:border-cyan-500 hover:bg-cyan-500/10 text-white rounded-xl font-semibold transition-all active:scale-95">
                  ↻ הקלטה חדשה
                </button>
                <button onClick={() => { setTranscribedText(null); reset(); }} className="py-3 px-4 border border-red-500/50 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-xl font-semibold transition-all active:scale-95">
                  🗑 בטל
                </button>
              </div>
            </div>
          )}

          {status === AppState.ANALYZING && (
            <div className="text-center space-y-6 py-12">
              <div className="flex justify-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-500 border-r-blue-500 animate-spin"></div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white">מנתח את השיחה...</h2>
              <p className="text-slate-400">Gemini AI מייצר סיכום, תגיות ונקודות חשובות</p>
            </div>
          )}

          {status === AppState.RESULT && result && (
            <div className="w-full space-y-8 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              {/* Header with Call Metadata */}
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-1">
                      תוצאות התמלול
                    </h2>
                    <p className="text-sm text-slate-400">
                      📅 {formatDate(result.timestamp)} | ⏱️ {Math.floor(timer / 60).toString().padStart(2, '0')}:{(timer % 60).toString().padStart(2, '0')} | 🗣️ {result.language === 'he' ? 'עברית' : 'אנגלית'}
                    </p>
                    {result.context && (
                      <p className="text-sm text-slate-300 mt-3 bg-slate-700/40 p-3 rounded-lg text-right border border-slate-600/50">
                        <span className="font-semibold text-cyan-400">הקשר:</span> {result.context}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={reset}
                    className="text-sm text-cyan-400 hover:text-cyan-300 font-semibold transition-colors px-4 py-2 hover:bg-slate-700/30 rounded-lg"
                  >
                    ↻ הקלטה חדשה
                  </button>
                </div>
              </div>

              {/* Visual Divider */}
              <div className="h-px bg-gradient-to-r from-slate-700 via-cyan-500/30 to-slate-700"></div>

              {/* Email Suggestion */}
              {result.email && result.email.trim() && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📧</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">הצעת דוא"ל</h3>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-900/25 to-purple-900/25 border border-blue-500/40 rounded-2xl text-slate-100 leading-relaxed text-right">
                    {result.email}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.email || '')}
                    className="w-full py-2 px-3 text-sm bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg font-semibold transition-all"
                  >
                    📋 העתק דוא"ל
                  </button>
                </section>
              )}

              {/* CRM Note */}
              {result.crmNote && result.crmNote.trim() && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📝</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">הערה לניהול קשרים</h3>
                  </div>
                  <div className="p-4 bg-slate-700/40 border border-slate-600/50 rounded-2xl text-slate-200 text-right">
                    {result.crmNote}
                  </div>
                </section>
              )}

              {/* Tags Display with Count */}
              {result.tags && result.tags.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📍</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                      אירועי שיחה
                      <span className="text-cyan-400 ml-2">
                        ({result.tags.filter(t => t.detected).length}/{result.tags.length})
                      </span>
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.tags.map(tag => (
                      <div
                        key={tag.id}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                          tag.detected
                            ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                            : 'bg-slate-700/30 text-slate-400 border border-slate-600/50 line-through'
                        }`}
                      >
                        {tag.label}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Key Points Card */}
              {result.keyPoints && result.keyPoints.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💎</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                      נקודות חזוקות
                      <span className="text-cyan-400 ml-2">({result.keyPoints.length})</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {result.keyPoints.map((kp, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveQuote(activeQuote === kp.quote ? null : kp.quote)}
                        className={`group p-4 rounded-xl border transition-all duration-200 text-right cursor-pointer ${
                          activeQuote === kp.quote
                            ? 'bg-gradient-to-br from-cyan-500/40 to-blue-500/40 border-cyan-400/60 shadow-lg shadow-cyan-500/30'
                            : 'bg-slate-700/20 border-slate-600/30 hover:bg-slate-700/40 hover:border-cyan-500/40'
                        }`}
                      >
                        <div className="flex items-start gap-3 justify-end">
                          <div className="flex-1">
                            <p className={`font-semibold transition-colors ${
                              activeQuote === kp.quote ? 'text-cyan-100' : 'text-slate-100 group-hover:text-cyan-200'
                            }`}>
                              {kp.label}
                            </p>
                            <p className={`text-xs mt-2 transition-colors ${
                              activeQuote === kp.quote ? 'text-cyan-200/80' : 'text-slate-400 group-hover:text-slate-300'
                            }`}>
                              "{kp.quote}"
                            </p>
                          </div>
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                            activeQuote === kp.quote
                              ? 'bg-cyan-500 text-slate-900'
                              : 'bg-slate-600/50 text-slate-300 group-hover:bg-cyan-500/30'
                          }`}>
                            {idx + 1}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Summary Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📝</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">סיכום המפגש</h3>
                </div>
                <div className="p-6 bg-gradient-to-br from-cyan-900/25 to-blue-900/25 border border-cyan-500/40 rounded-2xl text-slate-100 leading-relaxed space-y-4">
                  {result.summary}
                </div>
              </section>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-slate-700 via-cyan-500/30 to-slate-700"></div>

              {/* Full Transcript Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎤</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">תמלול מלא</h3>
                </div>
                <div ref={transcriptRef} className="p-6 bg-slate-900/40 border border-slate-600/30 rounded-2xl text-slate-200 leading-relaxed max-h-72 overflow-y-auto custom-scrollbar text-sm">
                  {renderHighlightedText(result.text, activeQuote)}
                </div>
              </section>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => navigator.clipboard.writeText(`${result.summary}\n\n${result.text}`)}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-cyan-500/30 active:scale-95 flex items-center justify-center gap-2"
                >
                  📋 העתק הכל
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 px-4 border border-slate-600 hover:border-cyan-500 hover:bg-cyan-500/10 text-white rounded-xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                >
                  🖨️ הדפס / PDF
                </button>
              </div>
            </div>
          )}

          {status === AppState.ERROR && (
            <div className="text-center space-y-6 py-12">
              <div className="bg-red-500/10 text-red-300 p-6 rounded-2xl border border-red-500/30 max-w-sm mx-auto">
                <p className="font-bold mb-2 text-red-200 text-lg">אופס! משהו השתבש</p>
                <p className="text-sm text-red-300">{errorMessage}</p>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                {lastFailedOperation && (
                  <button
                    onClick={retryLastOperation}
                    className="py-3 px-8 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-amber-500/25"
                  >
                    🔄 נסה שוב
                  </button>
                )}
                <button
                  onClick={reset}
                  className="py-3 px-8 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-cyan-500/25"
                >
                  ↻ התחל מחדש
                </button>
              </div>
            </div>
          )}

        </div>
        )}
      </main>

      <footer className="mt-10 text-slate-500 text-xs">
        &copy; {new Date().getFullYear()} Tamlelan - Powered by Gemini AI
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default App;

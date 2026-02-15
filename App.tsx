
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, TranscriptionResult, HistoryEntry, TranscriptionModel } from './types';
import { transcribeAudioGemini, analyzeTranscription } from './services/gemini';
import { transcribeAudioOpenAI } from './services/openai';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [timer, setTimer] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<HistoryEntry | null>(null);
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const [transcriptionModel, setTranscriptionModel] = useState<TranscriptionModel>('gemini');
  const [transcribedText, setTranscribedText] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Fix: Using number instead of NodeJS.Timeout for browser-based React application
  const intervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('calltranscribe_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Helper to format timestamp for display
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  // Delete history entry
  const deleteEntry = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem('calltranscribe_history', JSON.stringify(updated));
      return updated;
    });
    if (viewingEntry?.id === id) setViewingEntry(null);
  };

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setStatus(AppState.PROCESSING);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        try {
          const text = transcriptionModel === 'openai'
            ? await transcribeAudioOpenAI(audioBlob, 'audio/webm')
            : await transcribeAudioGemini(audioBlob, 'audio/webm');
          setTranscribedText(text);
          setStatus(AppState.TRANSCRIBED);
        } catch (err: any) {
          setErrorMessage(err.message || "שגיאה בתמלול");
          setStatus(AppState.ERROR);
        }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setStatus(AppState.PROCESSING);
    try {
      const text = transcriptionModel === 'openai'
        ? await transcribeAudioOpenAI(file, file.type)
        : await transcribeAudioGemini(file, file.type);
      setTranscribedText(text);
      setStatus(AppState.TRANSCRIBED);
    } catch (err: any) {
      setErrorMessage(err.message || "שגיאה בתמלול");
      setStatus(AppState.ERROR);
    }
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!transcribedText) return;
    setStatus(AppState.ANALYZING);
    try {
      const analysis = await analyzeTranscription(transcribedText);
      setResult({
        text: transcribedText,
        summary: analysis.summary,
        language: 'he',
        timestamp: new Date().toISOString(),
        tags: analysis.tags,
        keyPoints: analysis.keyPoints
      });
      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        text: transcribedText,
        summary: analysis.summary,
        language: 'he',
        timestamp: new Date().toISOString(),
        duration: timer,
        tags: analysis.tags,
        keyPoints: analysis.keyPoints
      };
      setHistory(prev => {
        const updated = [newEntry, ...prev];
        localStorage.setItem('calltranscribe_history', JSON.stringify(updated));
        return updated;
      });
      setStatus(AppState.RESULT);
    } catch (err: any) {
      setErrorMessage(err.message || "שגיאה בניתוח");
      setStatus(AppState.ERROR);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setStatus(AppState.IDLE);
    setResult(null);
    setErrorMessage(null);
    setTimer(0);
    setActiveQuote(null);
    setTranscribedText(null);
  };

  // Helper to render text with highlighted quote
  const renderHighlightedText = (text: string, quote: string | null) => {
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
              <button
                onClick={() => setShowHistory(false)}
                className="text-sm text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                חזור
              </button>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-lg">אין הקלטות שמורות</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {history.map(entry => (
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
                        <p className="text-sm text-slate-400 mt-2">{formatDate(entry.timestamp)}</p>
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
                ))}
              </div>
            )}
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
                      onMouseLeave={() => setActiveQuote(null)}
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
              <div className="p-6 bg-slate-900/40 border border-slate-600/30 rounded-2xl text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto custom-scrollbar font-mono text-sm">
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
              <div className="bg-slate-900/50 border border-cyan-500/30 p-6 rounded-2xl text-slate-200 text-sm">
                <p className="font-bold mb-3 text-white">הנחיות להקלטת שיחה:</p>
                <ul className="list-disc list-inside text-right space-y-2">
                  <li>לחץ על כפתור ההקלטה</li>
                  <li>אשר גישה למיקרופון</li>
                  <li>התחל לדבר - ההקלטה תתחיל באופן אוטומטי</li>
                </ul>
              </div>
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-400 font-semibold">מודל תמלול:</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setTranscriptionModel('gemini')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    transcriptionModel === 'gemini'
                      ? 'bg-cyan-500/30 text-cyan-200 border-cyan-500/60'
                      : 'bg-slate-700/30 text-slate-400 border-slate-600/50 hover:border-slate-500'
                  }`}>Gemini</button>
                  <button onClick={() => setTranscriptionModel('openai')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    transcriptionModel === 'openai'
                      ? 'bg-cyan-500/30 text-cyan-200 border-cyan-500/60'
                      : 'bg-slate-700/30 text-slate-400 border-slate-600/50 hover:border-slate-500'
                  }`}>OpenAI Whisper</button>
                </div>
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
              <p className="text-slate-400">{transcriptionModel === 'openai' ? 'OpenAI Whisper מתמלל את האודיו' : 'Gemini AI מתמלל את האודיו'}</p>
            </div>
          )}

          {status === AppState.TRANSCRIBED && transcribedText && (
            <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">תמלול הושלם</h2>
                <span className="text-green-400 text-sm font-semibold">✓ מוכן לניתוח</span>
              </div>
              <div className="p-6 bg-slate-900/40 border border-slate-600/30 rounded-2xl text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto custom-scrollbar font-mono text-sm text-right">
                {transcribedText}
              </div>
              <div className="flex gap-3">
                <button onClick={handleAnalyze} className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                  🔍 נתח שיחה
                </button>
                <button onClick={reset} className="py-3 px-4 border border-slate-600 hover:border-cyan-500 hover:bg-cyan-500/10 text-white rounded-xl font-semibold transition-all active:scale-95">
                  ↻ הקלטה חדשה
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
                        onMouseLeave={() => setActiveQuote(null)}
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
                <div className="p-6 bg-slate-900/40 border border-slate-600/30 rounded-2xl text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto custom-scrollbar font-mono text-sm">
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
              <button
                onClick={reset}
                className="py-3 px-8 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-cyan-500/25"
              >
                נסה שוב
              </button>
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

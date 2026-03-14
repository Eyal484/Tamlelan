import React from 'react';
import { AppState, TranscriptionResult } from '../../types';
import { CALL_TYPES } from '../hooks/useCallHistory';

interface Props {
    status: AppState;
    dualAudioMode: boolean;
    setDualAudioMode: (mode: boolean) => void;
    showContextInput: boolean;
    setShowContextInput: (show: boolean) => void;
    recordingContext: string;
    setRecordingContext: (ctx: string) => void;
    selectedCallType: string | null;
    setSelectedCallType: (type: string | null) => void;
    timer: number;
    formatTime: (seconds: number) => string;
    errorMessage: string | null;
    transcribedText: string | null;
    result: TranscriptionResult | null;
    audioUrl: string | null;
    startRecording: () => void;
    stopRecording: () => void;
    cancelRecording: () => void;
    handleTranscribe: () => void;
    handleAnalyze: () => void;
    retryLastOperation: () => void;
    reset: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
}

export const RecordingPanel: React.FC<Props> = ({
    status,
    dualAudioMode,
    setDualAudioMode,
    showContextInput,
    setShowContextInput,
    recordingContext,
    setRecordingContext,
    selectedCallType,
    setSelectedCallType,
    timer,
    formatTime,
    errorMessage,
    transcribedText,
    result,
    audioUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    handleTranscribe,
    handleAnalyze,
    retryLastOperation,
    reset,
    fileInputRef
}) => {
    return (
        <div className="flex flex-col items-center justify-center space-y-6">
            {status === AppState.IDLE && (
                <div className="text-center space-y-8 py-8">
                    {/* Mode Selection */}
                    <div className="flex gap-4 justify-center mb-6">
                        <button
                            onClick={() => setDualAudioMode(false)}
                            className={`px-6 py-3 rounded-xl font-semibold transition-all ${!dualAudioMode
                                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            🎤 מיקרופון בלבד
                        </button>
                        <button
                            onClick={() => setDualAudioMode(true)}
                            className={`px-6 py-3 rounded-xl font-semibold transition-all ${dualAudioMode
                                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            🔊 שני הצדדים
                        </button>
                    </div>

                    {/* Context Input */}
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
                    <div className="space-y-2 pb-4">
                        <label className="text-sm text-slate-400">סוג שיחה מעודף (אופציונלי):</label>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {CALL_TYPES.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setSelectedCallType(selectedCallType === type.id ? null : type.id)}
                                    className={`px-3 py-1.5 text-xs rounded-full font-semibold transition-all ${selectedCallType === type.id
                                        ? 'bg-cyan-500 text-slate-900 shadow-md shadow-cyan-500/20'
                                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Record Button */}
                    <button
                        onClick={startRecording}
                        className="group relative inline-flex items-center justify-center"
                    >
                        <div className="absolute inset-0 bg-cyan-400 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                        <div className="relative w-32 h-32 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center shadow-2xl transform transition-transform duration-200 hover:scale-105 active:scale-95 border-4 border-slate-800">
                            <span className="text-5xl drop-shadow-md">🎙️</span>
                        </div>
                        <span className="absolute -bottom-8 text-cyan-400 font-semibold tracking-wide text-sm">התחל הקלטה (Enter)</span>
                    </button>

                    <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t border-slate-700/50">
                        <span className="text-sm text-slate-400">או עקוף תמלול קיים:</span>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-cyan-100 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                            📁 העלאת קובץ Audio
                        </button>
                    </div>
                </div>
            )}

            {status === AppState.RECORDING && (
                <div className="text-center space-y-8 animate-in zoom-in duration-300">
                    <div className="relative w-40 h-40 mx-auto">
                        <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
                        <div className="absolute inset-2 bg-red-500 rounded-full animate-pulse opacity-40"></div>
                        <div className="absolute inset-4 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.5)] border-4 border-slate-800">
                            <span className="text-4xl font-mono text-white font-bold tabular-nums">
                                {formatTime(timer)}
                            </span>
                        </div>
                    </div>
                    <p className="text-red-400 font-semibold tracking-widest text-lg animate-pulse">מקליט עכשיו...</p>
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={cancelRecording}
                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold transition-all hover:text-white"
                        >
                            בטל (Esc)
                        </button>
                        <button
                            onClick={stopRecording}
                            className="px-8 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-red-500/50 transform hover:-translate-y-0.5"
                        >
                            עצור הקלטה
                        </button>
                    </div>
                </div>
            )}

            {(status === AppState.PROCESSING || status === AppState.ANALYZING) && (
                <div className="text-center space-y-6 py-12 animate-in fade-in">
                    <div className="inline-block relative">
                        <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl">{status === AppState.PROCESSING ? '🎙️' : '🧠'}</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xl text-cyan-300 font-bold tracking-wide">
                            {status === AppState.PROCESSING ? 'מתמלל את השיחה...' : 'מנתח ממצאים...'}
                        </p>
                        <p className="text-sm text-slate-400">
                            {status === AppState.PROCESSING ? 'ג׳מיני קורא את האודיו' : 'מכין הערות CRM, סיכום ומייל מעקב'}
                        </p>
                    </div>
                </div>
            )}

            {status === AppState.RECORDED && (
                <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-600/50 shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-4">ההקלטה הושלמה</h3>
                        {audioUrl && (
                            <audio controls src={audioUrl} className="w-full mb-6 outline-none" />
                        )}
                        <div className="flex gap-4">
                            <button
                                onClick={reset}
                                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors"
                            >
                                מחק והתחל מחדש
                            </button>
                            <button
                                onClick={handleTranscribe}
                                className="flex-2 px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-cyan-500/50"
                            >
                                תמלל עכשיו ⚡
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {status === AppState.TRANSCRIBED && transcribedText && (
                <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-slate-800/80 p-6 rounded-2xl border border-cyan-500/30 shadow-xl">
                        <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                            <span>✅</span> תמלול הושלם בהצלחה
                        </h3>
                        <div className="p-4 bg-slate-900/50 rounded-xl max-h-48 overflow-y-auto custom-scrollbar mb-6 text-right">
                            <p className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed font-mono">
                                {transcribedText}
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={reset}
                                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors"
                            >
                                התחל מחדש
                            </button>
                            <button
                                onClick={handleAnalyze}
                                className="flex-1 px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
                            >
                                <span>נתח שיחה והפק תובנות</span>
                                <span>🧠</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {status === AppState.RESULT && result && (
                <div className="w-full text-center space-y-6 animate-in zoom-in duration-500">
                    <div className="p-8 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 shadow-2xl shadow-green-500/10">
                        <span className="text-6xl mb-4 block drop-shadow-lg">✨</span>
                        <h2 className="text-3xl font-black text-white mb-2">השיחה נותחה ונשמרה!</h2>
                        <p className="text-green-300 font-medium mb-8">כל התובנות, המייל והסיכום עכשיו בהיסטוריה שלך.</p>
                        <button
                            onClick={reset}
                            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-green-500/50 hover:-translate-y-1"
                        >
                            + הקלטה חדשה
                        </button>
                    </div>
                </div>
            )}

            {status === AppState.ERROR && (
                <div className="text-center space-y-6 animate-in fade-in">
                    <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl">
                        <span className="text-4xl block mb-4">⚠️</span>
                        <p className="text-red-400 font-semibold text-lg">{errorMessage}</p>
                    </div>
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={reset}
                            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                            התחל מחדש
                        </button>
                        <button
                            onClick={retryLastOperation}
                            className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 rounded-lg transition-colors font-semibold"
                        >
                            ↻ נסה שוב
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

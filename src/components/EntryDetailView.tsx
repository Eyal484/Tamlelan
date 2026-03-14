import React, { useState } from 'react';
import { HistoryEntry } from '../../types';
import { CALL_TYPES } from '../hooks/useCallHistory';

interface Props {
    viewingEntry: HistoryEntry;
    setViewingEntry: (entry: HistoryEntry | null) => void;
    deleteEntry: (id: string) => void;
    updateEntryCallType: (id: string, newType: string | undefined) => void;
    formatDate: (iso: string) => string;
}

export const EntryDetailView: React.FC<Props> = ({
    viewingEntry,
    setViewingEntry,
    deleteEntry,
    updateEntryCallType,
    formatDate
}) => {
    const [activeQuote, setActiveQuote] = useState<string | null>(null);

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
                                                updateEntryCallType(viewingEntry.id, newType || undefined);
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

            <div className="h-px bg-gradient-to-r from-slate-700 via-cyan-500/30 to-slate-700"></div>

            {/* Tags Display */}
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
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${tag.detected
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

            {/* Key Points */}
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
                                className={`group p-4 rounded-xl border transition-all duration-200 text-right cursor-pointer ${activeQuote === kp.quote
                                    ? 'bg-gradient-to-br from-cyan-500/40 to-blue-500/40 border-cyan-400/60 shadow-lg shadow-cyan-500/30'
                                    : 'bg-slate-700/20 border-slate-600/30 hover:bg-slate-700/40 hover:border-cyan-500/40'
                                    }`}
                            >
                                <div className="flex items-start gap-3 justify-end">
                                    <div className="flex-1">
                                        <p className={`font-semibold transition-colors ${activeQuote === kp.quote ? 'text-cyan-100' : 'text-slate-100 group-hover:text-cyan-200'
                                            }`}>
                                            {kp.label}
                                        </p>
                                        <p className={`text-xs mt-2 transition-colors ${activeQuote === kp.quote ? 'text-cyan-200/80' : 'text-slate-400 group-hover:text-slate-300'
                                            }`}>
                                            "{kp.quote}"
                                        </p>
                                    </div>
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${activeQuote === kp.quote
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

            <div className="h-px bg-gradient-to-r from-slate-700 via-cyan-500/30 to-slate-700"></div>

            {/* Full Transcript */}
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
    );
};

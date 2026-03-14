import React, { useState } from 'react';
import { HistoryEntry } from '../../types';
import { CALL_TYPES } from '../hooks/useCallHistory';

interface Props {
    history: HistoryEntry[];
    setShowHistory: (show: boolean) => void;
    setViewingEntry: (entry: HistoryEntry) => void;
    deleteEntry: (id: string) => void;
    exportHistoryAsCSV: (setErrorMessage: (msg: string) => void) => void;
    setErrorMessage: (msg: string) => void;
    formatDate: (iso: string) => string;
}

export const HistoryPanel: React.FC<Props> = ({
    history,
    setShowHistory,
    setViewingEntry,
    deleteEntry,
    exportHistoryAsCSV,
    setErrorMessage,
    formatDate
}) => {
    const [searchQuery, setSearchQuery] = useState('');

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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-6">
                <h2 className="text-3xl font-bold text-white">הקלטות קודמות</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => exportHistoryAsCSV(setErrorMessage)}
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

            <input
                type="text"
                placeholder="חפש בהקלטות..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-right focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />

            {filteredHistory.length === 0 && history.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <p className="text-lg">אין הקלטות שמורות</p>
                </div>
            ) : filteredHistory.length === 0 && searchQuery ? (
                <div className="text-center py-12 text-slate-400">
                    <p className="text-lg">לא נמצאו תוצאות</p>
                </div>
            ) : (
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
            )}
        </div>
    );
};

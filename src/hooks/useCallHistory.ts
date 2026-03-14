import { useState, useEffect } from 'react';
import { HistoryEntry } from '../../types';

export const CALL_TYPES = [
    { id: 'performance_check', label: 'בדיקת ביצועים' },
    { id: 'renewal', label: 'חידוש/הזמנה חוזרת' },
    { id: 'new_prospect', label: 'לקוח חדש' },
    { id: 'follow_up', label: 'עקיבה על הצעה' },
    { id: 'reminder', label: 'תזכורת לשימוש' }
];

export const useCallHistory = () => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [viewingEntry, setViewingEntry] = useState<HistoryEntry | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('calltranscribe_history');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch { }
        }
    }, []);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    };

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

    const addEntry = (newEntry: HistoryEntry): boolean => {
        let success = true;
        setHistory(prev => {
            const updated = [newEntry, ...prev];
            try {
                localStorage.setItem('calltranscribe_history', JSON.stringify(updated));
            } catch (e) {
                console.error("Failed to save to localStorage:", e);
                success = false;
                return prev;
            }
            return updated;
        });
        return success;
    };

    const updateEntryCallType = (id: string, newType: string | undefined) => {
        setHistory(prev => {
            const updated = prev.map(e => e.id === id ? { ...e, callType: newType } : e);
            try {
                localStorage.setItem('calltranscribe_history', JSON.stringify(updated));
            } catch (e) {
                console.error("Failed to save to localStorage:", e);
            }
            return updated;
        });
        if (viewingEntry?.id === id) {
            setViewingEntry(prev => prev ? { ...prev, callType: newType } : null);
        }
    };

    const exportHistoryAsCSV = (setErrorMessage: (msg: string) => void) => {
        if (history.length === 0) {
            setErrorMessage("אין הקלטות להורדה");
            return;
        }

        const escapeCSVField = (field: string | undefined): string => {
            if (!field) return '';
            const fieldStr = String(field);
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

        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    return {
        history,
        viewingEntry,
        setViewingEntry,
        deleteEntry,
        addEntry,
        updateEntryCallType,
        exportHistoryAsCSV,
        formatDate
    };
};

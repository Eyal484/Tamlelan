import React, { useState, useEffect, useCallback } from 'react';
import type { CallListItem } from '../types';
import { fetchCalls, deleteCall as apiDeleteCall } from '../services/api';
import { useSSE } from '../hooks/useSSE';

interface Props {
  onSelectCall: (id: string) => void;
}

type DirectionFilter = 'all' | 'incoming' | 'outgoing';

function formatEpoch(epoch: number): string {
  const d = new Date(epoch * 1000);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return 'היום ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'אתמול ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) +
    ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getStatusInfo(status: string): { label: string; color: string } {
  switch (status) {
    case 'ANSWER': return { label: 'נענתה', color: 'bg-green-100 text-green-700' };
    case 'ABANDONE': return { label: 'ננטשה', color: 'bg-red-100 text-red-700' };
    case 'NOANSWER': return { label: 'לא נענתה', color: 'bg-yellow-100 text-yellow-700' };
    case 'BUSY': return { label: 'תפוס', color: 'bg-orange-100 text-orange-700' };
    case 'CANCEL': return { label: 'בוטלה', color: 'bg-gray-100 text-gray-600' };
    case 'VOEND': return { label: 'נותקה', color: 'bg-slate-100 text-slate-600' };
    case 'TE': return { label: 'הקלטה', color: 'bg-blue-100 text-blue-700' };
    case 'VOICEMAIL': return { label: 'תא קולי', color: 'bg-purple-100 text-purple-700' };
    default: return { label: status, color: 'bg-slate-100 text-slate-600' };
  }
}

function getDirectionIcon(direction: string): string {
  switch (direction) {
    case 'incoming': return '📲';
    case 'outgoing': return '📞';
    case 'internal': return '🔄';
    default: return '📱';
  }
}

const CallList: React.FC<Props> = ({ onSelectCall }) => {
  const [calls, setCalls] = useState<CallListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [searchTimeout, setSearchTimeout] = useState<number | null>(null);

  const loadCalls = useCallback(async (p: number, s: string, d: DirectionFilter) => {
    setLoading(true);
    try {
      const result = await fetchCalls({ page: p, limit: 30, search: s || undefined, direction: d });
      setCalls(result.calls);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load calls:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + reload on filter changes
  useEffect(() => {
    loadCalls(page, search, direction);
  }, [page, direction, loadCalls]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = window.setTimeout(() => {
      setPage(1);
      loadCalls(1, value, direction);
    }, 300);
    setSearchTimeout(timeout);
  };

  // SSE: real-time updates
  useSSE({
    onNewCall: useCallback((call: CallListItem) => {
      setCalls(prev => {
        // Don't add if already exists
        if (prev.some(c => c.ivruniqueid === call.ivruniqueid)) {
          return prev.map(c => c.ivruniqueid === call.ivruniqueid ? call : c);
        }
        return [call, ...prev];
      });
      setTotal(prev => prev + 1);
    }, []),
    onDeleteCall: useCallback((data: { ivruniqueid: string }) => {
      setCalls(prev => prev.filter(c => c.ivruniqueid !== data.ivruniqueid));
      setTotal(prev => Math.max(0, prev - 1));
    }, []),
    onUpdateCall: useCallback((data: { ivruniqueid: string; hasAnalysis?: boolean }) => {
      setCalls(prev => prev.map(c =>
        c.ivruniqueid === data.ivruniqueid
          ? { ...c, hasAnalysis: data.hasAnalysis ?? c.hasAnalysis }
          : c
      ));
    }, []),
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('למחוק שיחה זו?')) return;
    try {
      await apiDeleteCall(id);
      setCalls(prev => prev.filter(c => c.ivruniqueid !== id));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to delete call:', err);
    }
  };

  const exportCSV = () => {
    const headers = ['תאריך', 'מתקשר', 'יעד', 'כיוון', 'סוג', 'סטטוס', 'משך', 'נציג', 'מעגל', 'AI'];
    const rows = calls.map(c => [
      new Date(c.time * 1000).toISOString(),
      c.caller,
      c.target,
      c.direction,
      c.type,
      c.status,
      String(c.duration),
      c.representative_name,
      c.queuename,
      c.hasAI ? 'כן' : 'לא',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tamlelan-calls-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="חיפוש לפי מספר, נציג, מעגל..."
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 transition-all"
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Direction filter chips */}
          <div className="flex gap-1.5">
            {(['all', 'incoming', 'outgoing'] as DirectionFilter[]).map(d => (
              <button
                key={d}
                onClick={() => { setDirection(d); setPage(1); }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  direction === d
                    ? 'bg-cyan-100 text-cyan-700 shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {d === 'all' ? 'הכל' : d === 'incoming' ? '📲 נכנסות' : '📞 יוצאות'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{total} שיחות</span>
            <button
              onClick={exportCSV}
              className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium"
              title="ייצוא CSV"
            >
              📊 ייצוא
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && calls.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      )}

      {/* Empty state */}
      {!loading && calls.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <svg className="mx-auto mb-4 w-16 h-16 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <p className="text-lg font-medium mb-1">אין שיחות עדיין</p>
          <p className="text-sm">שיחות חדשות יופיעו כאן אוטומטית כשהן מתקבלות מ-Voicenter</p>
        </div>
      )}

      {/* Call list */}
      <div className="space-y-2">
        {calls.map((call) => {
          const statusInfo = getStatusInfo(call.status);
          return (
            <div
              key={call.ivruniqueid}
              onClick={() => onSelectCall(call.ivruniqueid)}
              className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:shadow-md hover:border-cyan-200 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Top row: caller/target + status */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{getDirectionIcon(call.direction)}</span>
                    <span className="text-sm font-bold text-slate-800 truncate">
                      {call.caller || 'לא ידוע'}
                    </span>
                    <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-sm text-slate-600 truncate">
                      {call.target || call.did || 'לא ידוע'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Bottom row: time, duration, type, rep, AI badge */}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{formatEpoch(call.time)}</span>
                    <span>{formatDuration(call.duration)}</span>
                    <span className="truncate">{call.type}</span>
                    {call.representative_name && (
                      <span className="truncate">👤 {call.representative_name}</span>
                    )}
                    {call.queuename && (
                      <span className="truncate">📋 {call.queuename}</span>
                    )}
                    {call.hasAI && (
                      <span className="text-cyan-500 font-medium flex-shrink-0">✨ AI</span>
                    )}
                    {call.hasAnalysis && (
                      <span className="text-green-500 font-medium flex-shrink-0">✅ נותח</span>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, call.ivruniqueid)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1 mr-2"
                  title="מחק שיחה"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            → הקודם
          </button>
          <span className="text-sm text-slate-500">
            עמוד {page} מתוך {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            הבא ←
          </button>
        </div>
      )}
    </div>
  );
};

export default CallList;

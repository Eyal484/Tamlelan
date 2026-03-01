import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { CallListItem } from '../types';
import { fetchCalls, deleteCall as apiDeleteCall, starCall as apiStarCall, aiSearch } from '../services/api';
import type { AiCallResult } from '../services/api';
import { useSSE } from '../hooks/useSSE';

interface Props {
  onSelectCall: (id: string, highlight?: string) => void;
  initialSearch?: string;
}

type DirectionFilter = 'all' | 'incoming' | 'outgoing' | 'starred';

// ── U7: Rep color palette ──
const REP_COLORS = [
  'bg-cyan-500', 'bg-violet-500', 'bg-amber-500',
  'bg-emerald-500', 'bg-rose-500', 'bg-indigo-500',
  'bg-fuchsia-500', 'bg-teal-500',
];

function getRepColor(name: string): string {
  if (!name) return 'bg-slate-400';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff;
  }
  return REP_COLORS[hash % REP_COLORS.length];
}

function getRepInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.slice(0, 2);
}

function formatEpoch(epoch: number): string {
  const d = new Date(epoch * 1000);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return 'היום ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString())
    return 'אתמול ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) +
    ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getStatusDotColor(status: string): string {
  switch (status) {
    case 'ANSWER': return 'bg-green-400';
    case 'ABANDONE': return 'bg-red-400';
    case 'NOANSWER': return 'bg-yellow-400';
    case 'BUSY': return 'bg-orange-400';
    default: return 'bg-slate-300';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ANSWER': return 'נענתה';
    case 'ABANDONE': return 'ננטשה';
    case 'NOANSWER': return 'לא נענתה';
    case 'BUSY': return 'תפוס';
    case 'CANCEL': return 'בוטלה';
    case 'VOICEMAIL': return 'תא קולי';
    default: return status;
  }
}

// F4: Objection labels
const OBJECTION_LABELS: Record<string, { label: string; color: string }> = {
  price: { label: '💰 מחיר', color: 'bg-orange-100 text-orange-700' },
  timing: { label: '⏰ תזמון', color: 'bg-blue-100 text-blue-700' },
  competitor: { label: '⚔️ מתחרה', color: 'bg-red-100 text-red-700' },
  not_relevant: { label: '🚫 לא רלוונטי', color: 'bg-slate-100 text-slate-500' },
  needs_approval: { label: '👥 אישור', color: 'bg-purple-100 text-purple-700' },
};

const TAG_LABELS: Record<string, string> = {
  self_intro: 'הצגה עצמית',
  offer_sent: 'הצעה נשלחה',
  offer_followup: 'מעקב הצעה',
  performance_issue: 'בעיית ביצועים',
};

// ── U11: Skeleton row ──
const SkeletonRow = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-slate-200 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2.5">
        <div className="h-4 bg-slate-200 rounded-lg w-3/4" />
        <div className="h-3 bg-slate-200 rounded-lg w-1/2" />
        <div className="h-3 bg-slate-200 rounded-lg w-2/3" />
      </div>
      <div className="w-5 h-5 bg-slate-200 rounded-full" />
    </div>
  </div>
);

const CallList: React.FC<Props> = ({ onSelectCall, initialSearch }) => {
  const [calls, setCalls] = useState<CallListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch || '');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchTimeout, setSearchTimeout] = useState<number | null>(null);
  const [newCallIds, setNewCallIds] = useState<Set<string>>(new Set()); // U3
  const [starLoading, setStarLoading] = useState<Set<string>>(new Set());

  // F8: AI search
  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<AiCallResult[] | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadCalls = useCallback(async (p: number, s: string, d: DirectionFilter, tags: string[]) => {
    setLoading(true);
    try {
      const isStarred = d === 'starred';
      const result = await fetchCalls({
        page: p,
        limit: 30,
        search: s || undefined,
        direction: isStarred ? undefined : (d === 'all' ? undefined : d),
        starred: isStarred ? true : undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
      setCalls(result.calls);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load calls:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalls(page, search, direction, activeTags);
  }, [page, direction, loadCalls]);

  // activeTags changes → reload
  useEffect(() => {
    setPage(1);
    loadCalls(1, search, direction, activeTags);
  }, [activeTags]);

  // Handle initialSearch prop change
  useEffect(() => {
    if (initialSearch !== undefined && initialSearch !== search) {
      setSearch(initialSearch);
      setPage(1);
      loadCalls(1, initialSearch, direction, activeTags);
    }
  }, [initialSearch]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setAiResults(null);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = window.setTimeout(() => {
      setPage(1);
      loadCalls(1, value, direction, activeTags);
    }, 300);
    setSearchTimeout(timeout);
  };

  const toggleTag = (tag: string) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // F8: AI semantic search
  const handleAiSearch = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResults(null);
    try {
      const result = await aiSearch(aiQuery);
      setAiResults(result.calls);
    } catch (err) {
      console.error('AI search failed:', err);
      setAiResults([]);
    } finally {
      setAiLoading(false);
    }
  };

  // SSE real-time updates
  useSSE({
    onNewCall: useCallback((call: CallListItem) => {
      setCalls(prev => {
        if (prev.some(c => c.ivruniqueid === call.ivruniqueid)) {
          return prev.map(c => c.ivruniqueid === call.ivruniqueid ? call : c);
        }
        // U3: mark new for 3s highlight
        setNewCallIds(ids => new Set([...ids, call.ivruniqueid]));
        setTimeout(() => {
          setNewCallIds(ids => { const next = new Set(ids); next.delete(call.ivruniqueid); return next; });
        }, 3000);
        return [call, ...prev];
      });
      setTotal(prev => prev + 1);
    }, []),
    onDeleteCall: useCallback((data: { ivruniqueid: string }) => {
      setCalls(prev => prev.filter(c => c.ivruniqueid !== data.ivruniqueid));
      setTotal(prev => Math.max(0, prev - 1));
    }, []),
    onUpdateCall: useCallback((data: { ivruniqueid: string; hasAnalysis?: boolean; starred?: boolean }) => {
      setCalls(prev => prev.map(c =>
        c.ivruniqueid === data.ivruniqueid
          ? { ...c, hasAnalysis: data.hasAnalysis ?? c.hasAnalysis, starred: data.starred ?? c.starred }
          : c
      ));
    }, []),
  });

  // F7: Star toggle
  const handleStar = async (e: React.MouseEvent, id: string, currentStarred: boolean) => {
    e.stopPropagation();
    if (starLoading.has(id)) return;
    setStarLoading(prev => new Set([...prev, id]));
    // Optimistic update
    setCalls(prev => prev.map(c => c.ivruniqueid === id ? { ...c, starred: !currentStarred } : c));
    try {
      await apiStarCall(id, !currentStarred);
    } catch (err) {
      // Revert on error
      setCalls(prev => prev.map(c => c.ivruniqueid === id ? { ...c, starred: currentStarred } : c));
      console.error('Failed to star:', err);
    } finally {
      setStarLoading(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

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
    const headers = ['תאריך', 'מתקשר', 'יעד', 'כיוון', 'סטטוס', 'משך', 'נציג', 'מעגל', 'AI', 'נותח', 'מועדף'];
    const src = displayCalls;
    const rows = src.map(c => [
      new Date(c.time * 1000).toISOString(), c.caller, c.target, c.direction,
      c.status, String(c.duration), c.representative_name, c.queuename,
      c.hasAI ? 'כן' : 'לא', c.hasAnalysis ? 'כן' : 'לא', c.starred ? 'כן' : 'לא',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tamlelan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayCalls = aiResults !== null ? aiResults : calls;
  const totalPages = Math.ceil(total / 30);

  // F2: collect available tags from current call list
  const availableTags = Array.from(new Set(calls.flatMap(c => c.detectedTags || [])));

  return (
    <div className="space-y-4">
      {/* ── Search + AI toggle (F8) ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {!aiMode ? (
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="חיפוש לפי מספר, נציג, מעגל, סיכום..."
              className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 transition-all"
            />
          ) : (
            <input
              ref={searchInputRef}
              type="text"
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
              placeholder='שאל: "שיחות שדיברתי על הנחה" או "לקוחות שהתנגדו למחיר"'
              className="w-full pr-10 pl-4 py-2.5 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-xl text-sm text-slate-800 placeholder-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 transition-all"
            />
          )}
        </div>

        {/* AI mode toggle */}
        <button
          onClick={() => { setAiMode(!aiMode); setAiResults(null); setTimeout(() => searchInputRef.current?.focus(), 50); }}
          className={`flex-shrink-0 w-11 h-11 rounded-xl text-base font-medium transition-all border-2 flex items-center justify-center ${
            aiMode
              ? 'bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-200'
              : 'bg-white text-slate-500 border-slate-200 hover:border-cyan-300 hover:text-cyan-600'
          }`}
          title="חיפוש AI סמנטי"
        >
          🤖
        </button>

        {aiMode && (
          <button
            onClick={handleAiSearch}
            disabled={aiLoading || !aiQuery.trim()}
            className="flex-shrink-0 px-4 h-11 rounded-xl bg-cyan-500 text-white text-sm font-bold hover:bg-cyan-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {aiLoading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : 'חפש'}
          </button>
        )}
      </div>

      {/* AI results label */}
      {aiResults !== null && (
        <div className="flex items-center gap-2">
          <span className="text-xs bg-cyan-100 text-cyan-700 px-2.5 py-1 rounded-full font-medium">
            🤖 {aiResults.length} תוצאות עבור &ldquo;{aiQuery}&rdquo;
          </span>
          <button
            onClick={() => { setAiResults(null); setAiMode(false); setAiQuery(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕ נקה
          </button>
        </div>
      )}

      {/* ── Filter chips (U13) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {/* Direction + starred chips */}
          {(['all', 'incoming', 'outgoing', 'starred'] as DirectionFilter[]).map(d => (
            <button
              key={d}
              onClick={() => { setDirection(d); setPage(1); loadCalls(1, search, d, activeTags); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                direction === d
                  ? 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-300'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {d === 'all' ? 'הכל' : d === 'incoming' ? '📲 נכנסות' : d === 'outgoing' ? '📞 יוצאות' : '★ מועדפים'}
            </button>
          ))}

          {/* F2: Tag filter chips */}
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`text-xs px-2.5 py-1.5 rounded-full font-medium transition-all ${
                activeTags.includes(tag)
                  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                  : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {TAG_LABELS[tag] || tag}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-400">{aiResults !== null ? aiResults.length : total} שיחות</span>
          <button onClick={exportCSV} className="text-xs px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors" title="ייצוא CSV">📊</button>
        </div>
      </div>

      {/* U11: Skeleton loading */}
      {loading && calls.length === 0 && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
        </div>
      )}

      {/* U12: Meaningful empty state */}
      {!loading && displayCalls.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          {direction === 'starred' ? (
            <>
              <div className="text-5xl mb-3">☆</div>
              <p className="text-lg font-medium mb-1">אין שיחות מועדפות עדיין</p>
              <p className="text-sm">לחץ ★ על שיחה כדי לשמור אותה כמועדפת</p>
            </>
          ) : search ? (
            <>
              <div className="text-5xl mb-3">🔍</div>
              <p className="text-lg font-medium mb-1">לא נמצאו תוצאות עבור &ldquo;{search}&rdquo;</p>
              <p className="text-sm">נסה מילת חיפוש שונה</p>
            </>
          ) : activeTags.length > 0 ? (
            <>
              <div className="text-5xl mb-3">🏷️</div>
              <p className="text-lg font-medium mb-1">אין שיחות עם התגיות שנבחרו</p>
              <button onClick={() => setActiveTags([])} className="text-sm text-cyan-600 hover:underline mt-2 block mx-auto">נקה פילטרים</button>
            </>
          ) : aiResults !== null ? (
            <>
              <div className="text-5xl mb-3">🤖</div>
              <p className="text-lg font-medium mb-1">לא נמצאו שיחות רלוונטיות</p>
              <p className="text-sm">נסה לנסח את החיפוש אחרת</p>
            </>
          ) : (
            <>
              <svg className="mx-auto mb-4 w-16 h-16 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <p className="text-lg font-medium mb-1">מחכים לשיחה הראשונה...</p>
              <p className="text-sm">שיחות יופיעו כאן אוטומטית כשהן מגיעות מ-Voicenter</p>
            </>
          )}
        </div>
      )}

      {/* ── Call rows (U5: richer layout) ── */}
      <div className="space-y-2">
        {displayCalls.map(call => {
          const isNew = newCallIds.has(call.ivruniqueid); // U3
          const repColor = getRepColor(call.representative_name);
          const repInitials = getRepInitials(call.representative_name);
          const objection = call.objectionType && call.objectionType !== 'none'
            ? OBJECTION_LABELS[call.objectionType] : null;
          const callAiHighlight = aiResults?.find(r => r.ivruniqueid === call.ivruniqueid)?.aiHighlight;

          return (
            <div
              key={call.ivruniqueid}
              onClick={() => {
                const aiResult = aiResults?.find(r => r.ivruniqueid === call.ivruniqueid);
                onSelectCall(call.ivruniqueid, aiResult?.aiHighlight);
              }}
              className={`bg-white rounded-xl border p-3.5 cursor-pointer hover:shadow-md transition-all duration-200 group ${
                isNew ? 'border-cyan-300 ring-2 ring-cyan-200 shadow-md shadow-cyan-100' : 'border-slate-200 hover:border-cyan-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* U5+U7: Colored rep initials circle */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${repColor} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                  {repInitials}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Row 1: caller → target + status dot */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotColor(call.status)}`} />
                    <span className="text-sm font-bold text-slate-800 truncate">{call.caller || 'לא ידוע'}</span>
                    <span className="text-slate-300 text-xs flex-shrink-0">→</span>
                    <span className="text-sm text-slate-600 truncate">{call.target || call.did || 'לא ידוע'}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{getStatusLabel(call.status)}</span>
                  </div>

                  {/* Row 2: time · duration · direction */}
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                    <span>{formatEpoch(call.time)}</span>
                    <span>·</span>
                    <span>{formatDuration(call.duration)}</span>
                    {call.direction === 'incoming' && <span className="text-cyan-400">📲</span>}
                    {call.direction === 'outgoing' && <span className="text-emerald-400">📞</span>}
                  </div>

                  {/* Row 3: rep · queue · badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {call.representative_name && (
                      <span className="text-xs text-slate-500 font-medium">{call.representative_name}</span>
                    )}
                    {call.queuename && (
                      <span className="text-[11px] text-slate-400 truncate max-w-[140px]">· {call.queuename}</span>
                    )}
                    {call.hasAI && !call.hasAnalysis && (
                      <span className="text-[10px] text-cyan-500 font-bold">✨ AI</span>
                    )}
                    {call.hasAnalysis && (
                      <span className="text-[10px] text-green-600 font-bold">✅ נותח</span>
                    )}
                    {objection && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${objection.color}`}>
                        {objection.label}
                      </span>
                    )}
                    {isNew && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-cyan-100 text-cyan-600 rounded-full font-bold animate-pulse">
                        חדש!
                      </span>
                    )}
                  </div>

                  {/* F8: AI highlight reason */}
                  {callAiHighlight && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-[10px] text-cyan-400">🤖</span>
                      <span className="text-[10px] text-cyan-600 italic truncate">{callAiHighlight}</span>
                    </div>
                  )}
                </div>

                {/* Right: star (F7) + delete */}
                <div className="flex flex-col items-center gap-2.5 flex-shrink-0 pt-0.5">
                  <button
                    onClick={e => handleStar(e, call.ivruniqueid, call.starred)}
                    disabled={starLoading.has(call.ivruniqueid)}
                    className={`text-lg leading-none transition-all duration-150 hover:scale-110 ${
                      call.starred
                        ? 'text-amber-400 opacity-100'
                        : 'text-slate-200 opacity-0 group-hover:opacity-100 hover:text-amber-300'
                    }`}
                    title={call.starred ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                  >
                    {call.starred ? '★' : '☆'}
                  </button>
                  <button
                    onClick={e => handleDelete(e, call.ivruniqueid)}
                    className="text-slate-200 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {aiResults === null && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">
            → הקודם
          </button>
          <span className="text-sm text-slate-500">עמוד {page} מתוך {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">
            הבא ←
          </button>
        </div>
      )}
    </div>
  );
};

export default CallList;

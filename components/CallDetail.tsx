import React, { useState, useEffect } from 'react';
import type { VoicenterCall, VoicenterTranscriptSentence, CallDetailTab, GeminiAnalysis } from '../types';
import { fetchCall, fetchCalls } from '../services/api';
import CallMetadata from './CallMetadata';
import TranscriptView from './TranscriptView';
import InsightsView from './InsightsView';
import EmotionsView from './EmotionsView';
import AnalysisView from './AnalysisView';

interface Props {
  callId: string;
  onBack: () => void;
  onSearchCaller?: (caller: string) => void;
  aiHighlight?: string | null; // reason phrase from AI search — auto-opens transcript at matching sentence
}

const TABS: { id: CallDetailTab; label: string; icon: string; alwaysShow?: boolean }[] = [
  { id: 'analysis', label: 'ניתוח', icon: '🔬', alwaysShow: true },
  { id: 'transcript', label: 'תמלול', icon: '📝' },
  { id: 'insights', label: 'סיכום', icon: '💡' },
  { id: 'emotions', label: 'רגשות', icon: '😊' },
  { id: 'metadata', label: 'פרטים', icon: 'ℹ️', alwaysShow: true },
];

function formatEpoch(epoch: number): string {
  const d = new Date(epoch * 1000);
  return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SCHEDULING_KEYWORDS = [
  'נדבר', 'אדבר', 'נפגש', 'אפגש', 'שבוע הבא', 'בשבוע הבא',
  'מחר', 'ניצור קשר', 'אצור קשר', 'אחזור אליך', 'אחזור אליכם',
  'תחזור אלינו', 'נקבע פגישה', 'לקבוע פגישה',
  'בשלישי', 'ברביעי', 'בחמישי', 'בשני', 'בראשון', 'בשישי',
];

function findSentenceByKeywords(
  transcript: VoicenterTranscriptSentence[],
  keywords: string,
): number | null {
  if (!transcript.length || !keywords) return null;
  const words = keywords.trim().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return null;
  let bestId: number | null = null;
  let bestScore = 0;
  for (const sentence of transcript) {
    const score = words.filter(w => sentence.text.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestId = sentence.sentence_id;
    }
  }
  return bestScore > 0 ? bestId : null;
}

function findSentenceByQuote(
  transcript: VoicenterTranscriptSentence[],
  quote: string,
): number | null {
  if (!transcript.length || !quote) return null;
  const clean = quote.trim();
  const exact = transcript.find(s => s.text.includes(clean));
  if (exact) return exact.sentence_id;
  const short = clean.slice(0, 20);
  if (short.length > 4) {
    const partial = transcript.find(s => s.text.includes(short));
    if (partial) return partial.sentence_id;
  }
  return null;
}

const CallDetail: React.FC<Props> = ({ callId, onBack, onSearchCaller, aiHighlight }) => {
  const [call, setCall] = useState<VoicenterCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CallDetailTab>('analysis');
  const [prevTab, setPrevTab] = useState<CallDetailTab | null>(null); // U9

  // F5: Contact thread count
  const [callerCallCount, setCallerCallCount] = useState<number | null>(null);

  // AI search: sentence to focus in transcript
  const [aiFocusSentenceId, setAiFocusSentenceId] = useState<number | null>(null);

  // Transcript side panel
  const [transcriptPanelOpen, setTranscriptPanelOpen] = useState(false);
  const [transcriptPanelFocusId, setTranscriptPanelFocusId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCall(callId)
      .then(data => {
        if (!cancelled) {
          setCall(data);
          setAiFocusSentenceId(null);

          // If opened from AI search: find matching sentence and switch to transcript tab
          if (aiHighlight && data.aiData?.transcript && data.aiData.transcript.length > 0) {
            const sid = findSentenceByKeywords(data.aiData.transcript, aiHighlight);
            if (sid !== null) setAiFocusSentenceId(sid);
            setActiveTab('transcript');
          } else {
            setActiveTab('analysis');
          }

          // F5: fetch count of calls from same caller
          if (data.caller) {
            fetchCalls({ search: data.caller, limit: 100 }).then(result => {
              if (!cancelled) {
                // Exclude current call from count
                const count = result.calls.filter(c => c.ivruniqueid !== callId).length;
                setCallerCallCount(count);
              }
            }).catch(() => {});
          }
        }
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [callId]);

  const handleAnalysisComplete = (analysis: GeminiAnalysis) => {
    if (!call) return;
    setCall({ ...call, geminiAnalysis: analysis });
  };

  const openTranscriptAtQuote = (quote: string) => {
    const transcript = call?.aiData?.transcript;
    if (!transcript) return;
    const sentenceId = findSentenceByQuote(transcript, quote);
    setTranscriptPanelFocusId(sentenceId);
    setTranscriptPanelOpen(true);
  };

  const openTranscriptAtSentence = (sentenceId: number | null) => {
    setTranscriptPanelFocusId(sentenceId);
    setTranscriptPanelOpen(true);
  };

  // U9: Tab switch with fade
  const switchTab = (tab: CallDetailTab) => {
    if (tab === activeTab) return;
    setPrevTab(activeTab);
    setActiveTab(tab);
    setTimeout(() => setPrevTab(null), 200);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-lg mb-4">{error || 'שיחה לא נמצאה'}</p>
        <button onClick={onBack} className="text-cyan-600 hover:text-cyan-700 font-medium">← חזרה לרשימה</button>
      </div>
    );
  }

  const hasAI = !!(call.aiData && (call.aiData.transcript || call.aiData.insights || call.aiData.emotions));
  const hasTranscript = !!(call.aiData?.transcript && call.aiData.transcript.length > 0);

  const schedulingSentence = call.aiData?.transcript
    ? [...call.aiData.transcript].reverse().find(s =>
        SCHEDULING_KEYWORDS.some(kw => s.text.includes(kw))
      )
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-cyan-600 hover:text-cyan-700 font-medium text-sm transition-colors"
        >
          <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          חזרה
        </button>
        <div className="text-left text-sm text-slate-500">
          {formatEpoch(call.time)} • {formatDuration(call.duration)}
        </div>
      </div>

      {/* Call summary card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold">{call.caller || 'לא ידוע'}</div>
              {/* F5: Contact thread count */}
              {callerCallCount !== null && callerCallCount > 0 && (
                <button
                  onClick={() => onSearchCaller?.(call.caller)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors font-medium"
                  title={`${callerCallCount} שיחות נוספות עם מספר זה`}
                >
                  🔗 {callerCallCount} שיחות נוספות
                </button>
              )}
            </div>
            <div className="text-sm text-slate-300">→ {call.target || call.did || 'לא ידוע'}</div>
          </div>
          <div className="flex items-center gap-2">
            {call.geminiAnalysis && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-bold">נותח</span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              call.status === 'ANSWER' ? 'bg-green-500/20 text-green-300' :
              call.status === 'ABANDONE' ? 'bg-red-500/20 text-red-300' :
              'bg-slate-500/20 text-slate-300'
            }`}>
              {call.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{call.type}</span>
          {call.representative_name && <span>נציג: {call.representative_name}</span>}
          {call.queuename && <span>מעגל: {call.queuename}</span>}
          {hasAI && <span className="text-cyan-300 font-medium">✨ AI</span>}
        </div>

        {call.geminiAnalysis?.summary ? (
          <p className="mt-3 text-sm text-slate-300 leading-relaxed border-t border-slate-700 pt-3">
            {call.geminiAnalysis.summary}
          </p>
        ) : call.aiData?.insights?.summary ? (
          <p className="mt-3 text-sm text-slate-300 leading-relaxed border-t border-slate-700 pt-3">
            {call.aiData.insights.summary}
          </p>
        ) : null}
      </div>

      {/* Scheduling card */}
      {schedulingSentence && hasTranscript && (
        <div
          onClick={() => openTranscriptAtSentence(schedulingSentence.sentence_id)}
          className="cursor-pointer bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 hover:bg-blue-100 transition-colors"
        >
          <span className="text-xl">📅</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-blue-600 mb-0.5">שיחה / פגישה קרובה</div>
            <div className="text-sm text-slate-700 truncate">&ldquo;{schedulingSentence.text}&rdquo;</div>
          </div>
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(tab => {
          if (!tab.alwaysShow) {
            if (tab.id === 'transcript' && !hasTranscript) return null;
            if (tab.id === 'insights' && !call.aiData?.insights) return null;
            if (tab.id === 'emotions' && !call.aiData?.emotions?.sentences?.length) return null;
          }
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex-1 text-sm font-medium py-2 px-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="ml-1">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content — U9: fade transition */}
      <div
        className="min-h-[300px] transition-opacity duration-200"
        style={{ opacity: prevTab !== null ? 0 : 1 }}
      >
        {activeTab === 'analysis' && (
          <AnalysisView
            callId={callId}
            analysis={call.geminiAnalysis}
            hasTranscript={hasTranscript}
            onAnalysisComplete={handleAnalysisComplete}
            onOpenTranscript={hasTranscript ? openTranscriptAtQuote : undefined}
          />
        )}
        {activeTab === 'metadata' && <CallMetadata call={call} />}
        {activeTab === 'transcript' && (
          <TranscriptView
            transcript={call.aiData?.transcript}
            emotions={call.aiData?.emotions?.sentences}
            focusSentenceId={aiFocusSentenceId ?? transcriptPanelFocusId}
            aiHighlight={aiHighlight}
          />
        )}
        {activeTab === 'insights' && (
          <InsightsView
            insights={call.aiData?.insights}
            schedulingSentence={schedulingSentence}
            onSchedulingClick={() => openTranscriptAtSentence(schedulingSentence?.sentence_id ?? null)}
          />
        )}
        {activeTab === 'emotions' && (
          <EmotionsView
            emotions={call.aiData?.emotions?.sentences}
            transcript={call.aiData?.transcript}
          />
        )}
      </div>

      {/* ── Sliding transcript side panel ── */}
      {hasTranscript && (
        <>
          <div
            className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
              transcriptPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setTranscriptPanelOpen(false)}
          />

          <div
            className={`fixed top-0 left-0 h-full bg-white shadow-2xl z-50 flex flex-col
              w-1/3 min-w-[260px] max-w-[420px]
              transition-transform duration-300 ease-in-out
              ${transcriptPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <h3 className="font-bold text-slate-800 text-sm">📝 תמלול</h3>
              <button
                onClick={() => setTranscriptPanelOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <TranscriptView
                transcript={call.aiData?.transcript}
                emotions={call.aiData?.emotions?.sentences}
                focusSentenceId={transcriptPanelFocusId}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CallDetail;

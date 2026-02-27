import React, { useState, useEffect } from 'react';
import type { VoicenterCall, CallDetailTab, GeminiAnalysis } from '../types';
import { fetchCall } from '../services/api';
import CallMetadata from './CallMetadata';
import TranscriptView from './TranscriptView';
import InsightsView from './InsightsView';
import EmotionsView from './EmotionsView';
import AnalysisView from './AnalysisView';

interface Props {
  callId: string;
  onBack: () => void;
}

const TABS: { id: CallDetailTab; label: string; icon: string; alwaysShow?: boolean }[] = [
  { id: 'analysis', label: 'ניתוח', icon: '🔬', alwaysShow: true },
  { id: 'transcript', label: 'תמלול', icon: '📝' },
  { id: 'insights', label: 'סיכום קצר', icon: '💡' },
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

const CallDetail: React.FC<Props> = ({ callId, onBack }) => {
  const [call, setCall] = useState<VoicenterCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CallDetailTab>('analysis');
  const [focusSentenceId, setFocusSentenceId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCall(callId)
      .then((data) => {
        if (!cancelled) {
          setCall(data);
          // Default to analysis tab if transcript exists, otherwise metadata
          if (data.geminiAnalysis || (data.aiData?.transcript && data.aiData.transcript.length > 0)) {
            setActiveTab('analysis');
          } else {
            setActiveTab('metadata');
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [callId]);

  const handleAnalysisComplete = (analysis: GeminiAnalysis) => {
    if (!call) return;
    // If null passed (re-analyze), clear the analysis
    if (!analysis) {
      setCall({ ...call, geminiAnalysis: undefined });
      return;
    }
    setCall({ ...call, geminiAnalysis: analysis });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-lg mb-4">{error || 'שיחה לא נמצאה'}</p>
        <button onClick={onBack} className="text-cyan-600 hover:text-cyan-700 font-medium">
          ← חזרה לרשימה
        </button>
      </div>
    );
  }

  const hasAI = !!(call.aiData && (call.aiData.transcript || call.aiData.insights || call.aiData.emotions));
  const hasTranscript = !!(call.aiData?.transcript && call.aiData.transcript.length > 0);

  // Detect scheduling sentence (search from end of transcript for latest mention)
  const schedulingSentence = call.aiData?.transcript
    ? [...call.aiData.transcript].reverse().find(s =>
        SCHEDULING_KEYWORDS.some(kw => s.text.includes(kw))
      )
    : null;

  const handleSchedulingClick = () => {
    setActiveTab('transcript');
    setFocusSentenceId(schedulingSentence?.sentence_id ?? null);
  };

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
            <div className="text-lg font-bold">{call.caller || 'לא ידוע'}</div>
            <div className="text-sm text-slate-300">
              → {call.target || call.did || 'לא ידוע'}
            </div>
          </div>
          <div className="text-left flex items-center gap-2">
            {call.geminiAnalysis && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-bold">
                נותח
              </span>
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
        {/* Gemini summary if analyzed, otherwise Voicenter summary */}
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

      {/* Next call scheduling card */}
      {schedulingSentence && hasTranscript && (
        <div
          onClick={handleSchedulingClick}
          className="cursor-pointer bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 hover:bg-blue-100 transition-colors"
        >
          <span className="text-xl">📅</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-blue-600 mb-0.5">שיחה / פגישה קרובה</div>
            <div className="text-sm text-slate-700 truncate">"{schedulingSentence.text}"</div>
          </div>
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((tab) => {
          // Skip AI tabs if no AI data (except analysis + metadata which always show)
          if (!tab.alwaysShow) {
            if (tab.id === 'transcript' && !hasTranscript) return null;
            if (tab.id === 'insights' && !call.aiData?.insights) return null;
            if (tab.id === 'emotions' && !call.aiData?.emotions?.sentences?.length) return null;
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all ${
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

      {/* Tab content */}
      <div className="min-h-[300px]">
        {activeTab === 'analysis' && (
          <AnalysisView
            callId={callId}
            analysis={call.geminiAnalysis}
            hasTranscript={hasTranscript}
            onAnalysisComplete={handleAnalysisComplete}
          />
        )}
        {activeTab === 'metadata' && <CallMetadata call={call} />}
        {activeTab === 'transcript' && (
          <TranscriptView
            transcript={call.aiData?.transcript}
            emotions={call.aiData?.emotions?.sentences}
            focusSentenceId={focusSentenceId}
          />
        )}
        {activeTab === 'insights' && <InsightsView insights={call.aiData?.insights} />}
        {activeTab === 'emotions' && (
          <EmotionsView
            emotions={call.aiData?.emotions?.sentences}
            transcript={call.aiData?.transcript}
          />
        )}
      </div>
    </div>
  );
};

export default CallDetail;

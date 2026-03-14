import React, { useState, useEffect } from 'react';
import type { GeminiAnalysis } from '../types';
import { analyzeCall, askCall } from '../services/api';

interface Props {
  callId: string;
  analysis: GeminiAnalysis | null | undefined;
  hasTranscript: boolean;
  onAnalysisComplete: (analysis: GeminiAnalysis) => void;
  onOpenTranscript?: (quote: string) => void;
}

const CALL_TYPES = [
  { id: 'new_prospect', label: 'לקוח חדש', icon: '🆕' },
  { id: 'follow_up', label: 'מעקב', icon: '🔄' },
  { id: 'renewal', label: 'חידוש', icon: '📋' },
  { id: 'performance_check', label: 'בדיקת ביצועים', icon: '📊' },
  { id: 'reminder', label: 'תזכורת', icon: '⏰' },
];

const GENERIC_CONTEXT = 'שיחת מכירה בעברית. נציג מדבר עם לקוח פוטנציאלי. יש לנתח את השיחה מנקודת מבט של מנהל מכירות.';

const TAG_LABELS: Record<string, string> = {
  self_intro: 'הצגה עצמית',
  offer_sent: 'נשלחה הצעה',
  offer_followup: 'מעקב הצעה',
  performance_issue: 'בעיית ביצועים',
};

const OBJECTION_INFO: Record<string, { label: string; color: string; bg: string }> = {
  price: { label: '💰 התנגדות מחיר', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  timing: { label: '⏰ התנגדות תזמון', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  competitor: { label: '⚔️ מתחרה / חלופה', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  not_relevant: { label: '🚫 לא רלוונטי', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
  needs_approval: { label: '👥 צריך אישור', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
};

// U2: Analysis progress stages
const ANALYSIS_STAGES = [
  'קורא את השיחה...',
  'מזהה נקודות מפתח...',
  'מנתח ביצועי נציג...',
  'מכין טיוטת מייל...',
  'מסיים ניתוח...',
];

// ── U1: Copy button with animation ──
const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`text-xs font-medium transition-all duration-200 px-2 py-0.5 rounded-lg ${
        copied
          ? 'bg-green-100 text-green-600'
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
      }`}
    >
      {copied ? '✅ הועתק!' : (label || '📋 העתק')}
    </button>
  );
};

// ── Shared analyze form ──
const AnalyzeForm: React.FC<{
  selectedType: string;
  onTypeChange: (t: string) => void;
  customContext: string;
  onContextChange: (v: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  stageIndex: number;
  error: string | null;
  compact?: boolean;
}> = ({ selectedType, onTypeChange, customContext, onContextChange, onAnalyze, loading, stageIndex, error, compact }) => (
  <div className={`space-y-4 ${compact ? '' : ''}`}>
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">סוג שיחה:</label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CALL_TYPES.map(ct => (
          <button
            key={ct.id}
            onClick={() => onTypeChange(ct.id)}
            className={`text-sm py-2.5 px-3 rounded-xl border-2 font-medium transition-all ${
              selectedType === ct.id
                ? 'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <span className="ml-1">{ct.icon}</span>
            {ct.label}
          </button>
        ))}
      </div>
    </div>

    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-slate-700">הקשר (אופציונלי):</label>
        <button
          onClick={() => onContextChange(customContext === GENERIC_CONTEXT ? '' : GENERIC_CONTEXT)}
          className="text-xs text-cyan-600 hover:text-cyan-800 font-medium px-2 py-0.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 transition-colors"
        >
          {customContext === GENERIC_CONTEXT ? '✕ נקה' : '⚙️ הקשר גנרי'}
        </button>
      </div>
      <textarea
        value={customContext}
        onChange={e => onContextChange(e.target.value)}
        placeholder="הוסף הקשר: שם לקוח, מוצר, שלב במשפך, הערות מיוחדות..."
        rows={3}
        className="w-full text-sm border border-slate-200 rounded-xl p-3 text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
      />
    </div>

    {error && (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
    )}

    <button
      onClick={onAnalyze}
      disabled={loading}
      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-200/50"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {/* U2: Progress stage text */}
          {ANALYSIS_STAGES[stageIndex]}
        </span>
      ) : '🔬 נתח שיחה'}
    </button>
  </div>
);

const AnalysisView: React.FC<Props> = ({ callId, analysis, hasTranscript, onAnalysisComplete, onOpenTranscript }) => {
  const [selectedType, setSelectedType] = useState(analysis?.callType || 'new_prospect');
  const [customContext, setCustomContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0); // U2
  const [error, setError] = useState<string | null>(null);
  const [showReanalyze, setShowReanalyze] = useState(false);

  // F9: Ask Gemini
  const [question, setQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  // U2: Cycle through stages while loading
  useEffect(() => {
    if (!loading) { setStageIndex(0); return; }
    const interval = setInterval(() => {
      setStageIndex(i => Math.min(i + 1, ANALYSIS_STAGES.length - 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setStageIndex(0);
    try {
      const result = await analyzeCall(callId, selectedType, customContext || undefined);
      onAnalysisComplete(result);
      setShowReanalyze(false);
    } catch (err: any) {
      setError(err.message || 'שגיאה בניתוח');
    } finally {
      setLoading(false);
    }
  };

  // F9: Ask handler
  const handleAsk = async () => {
    if (!question.trim()) return;
    setAskLoading(true);
    setAskError(null);
    setAskAnswer(null);
    try {
      const result = await askCall(callId, question);
      setAskAnswer(result.answer);
    } catch (err: any) {
      setAskError(err.message || 'שגיאה');
    } finally {
      setAskLoading(false);
    }
  };

  // No transcript
  if (!hasTranscript) {
    return (
      <div className="text-center py-12 text-slate-400">
        <svg className="mx-auto mb-3 w-12 h-12 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="font-medium">אין תמלול זמין</p>
        <p className="text-sm mt-1">לא ניתן לנתח שיחה ללא תמלול</p>
      </div>
    );
  }

  // Not yet analyzed
  if (!analysis) {
    return (
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="text-4xl mb-3">🔬</div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">ניתוח שיחה עם AI</h3>
          <p className="text-sm text-slate-500">בחר סוג שיחה וקבל ניתוח מפורט: סיכום, תגיות, נקודות מפתח, מייל מעקב והערת CRM</p>
        </div>
        <AnalyzeForm
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          customContext={customContext}
          onContextChange={setCustomContext}
          onAnalyze={handleAnalyze}
          loading={loading}
          stageIndex={stageIndex}
          error={error}
        />
      </div>
    );
  }

  // Show results
  const objectionInfo = analysis.objectionType && analysis.objectionType !== 'none'
    ? OBJECTION_INFO[analysis.objectionType] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>סוג: {CALL_TYPES.find(ct => ct.id === analysis.callType)?.label || analysis.callType}</span>
        <span>{new Date(analysis.analyzedAt).toLocaleString('he-IL')}</span>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-100">
        <h4 className="text-xs font-bold text-cyan-700 mb-1.5 uppercase tracking-wider">סיכום</h4>
        <p className="text-sm text-slate-800 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* F4: Objection type badge */}
      {objectionInfo && (
        <div className={`rounded-xl p-3 border flex items-center gap-2 ${objectionInfo.bg}`}>
          <span className={`text-sm font-bold ${objectionInfo.color}`}>{objectionInfo.label}</span>
          <span className="text-xs text-slate-500">— ההתנגדות העיקרית בשיחה</span>
        </div>
      )}

      {/* Tags */}
      <div>
        <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">תגיות</h4>
        <div className="flex flex-wrap gap-2">
          {analysis.tags.map(tag => (
            <span
              key={tag.id}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                tag.detected
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 line-through'
              }`}
            >
              {tag.detected ? '✓' : '✗'} {TAG_LABELS[tag.id] || tag.label}
            </span>
          ))}
        </div>
      </div>

      {/* Key Points */}
      {analysis.keyPoints.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">נקודות מפתח</h4>
          <div className="space-y-2">
            {analysis.keyPoints.map((kp, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-sm font-medium text-slate-800 flex-1">{kp.label}</div>
                  {onOpenTranscript && kp.quote && (
                    <button
                      onClick={() => onOpenTranscript(kp.quote)}
                      className="flex-shrink-0 text-[11px] text-cyan-600 hover:text-cyan-800 font-medium px-2 py-0.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 transition-colors flex items-center gap-1"
                    >
                      📍 <span>בתמלול</span>
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500 italic border-r-2 border-cyan-300 pr-3">
                  &quot;{kp.quote}&quot;
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up Email */}
      {analysis.email && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">טיוטת מייל מעקב</h4>
            <CopyButton text={analysis.email} />
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{analysis.email}</p>
          </div>
        </div>
      )}

      {/* CRM Note */}
      {analysis.crmNote && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">הערת CRM</h4>
            <CopyButton text={analysis.crmNote} />
          </div>
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-3">
            <p className="text-sm text-slate-700 font-medium">{analysis.crmNote}</p>
          </div>
        </div>
      )}

      {/* F9: Ask Gemini about this call */}
      <div className="pt-2 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">🤖 שאל על השיחה</h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !askLoading && handleAsk()}
            placeholder="מה הייתה ההתנגדות העיקרית? האם הנציג בצע close?"
            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
          />
          <button
            onClick={handleAsk}
            disabled={askLoading || !question.trim()}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            {askLoading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : 'שאל'}
          </button>
        </div>
        {askError && <p className="text-xs text-red-500 mt-1">{askError}</p>}
        {askAnswer && (
          <div className="mt-3 bg-slate-50 rounded-xl border border-slate-200 p-3">
            <p className="text-sm text-slate-700 leading-relaxed">{askAnswer}</p>
          </div>
        )}
      </div>

      {/* Re-analyze */}
      <div className="pt-2 border-t border-slate-100">
        {!showReanalyze ? (
          <button
            onClick={() => { setSelectedType(analysis.callType || 'new_prospect'); setCustomContext(''); setShowReanalyze(true); }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            🔄 נתח מחדש עם הגדרות שונות
          </button>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700">🔄 ניתוח מחדש</h4>
              <button onClick={() => setShowReanalyze(false)} className="text-xs text-slate-400 hover:text-slate-600">ביטול</button>
            </div>
            <AnalyzeForm
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              customContext={customContext}
              onContextChange={setCustomContext}
              onAnalyze={handleAnalyze}
              loading={loading}
              stageIndex={stageIndex}
              error={error}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisView;

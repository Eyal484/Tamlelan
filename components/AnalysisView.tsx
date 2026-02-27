import React, { useState } from 'react';
import type { GeminiAnalysis } from '../types';
import { analyzeCall } from '../services/api';

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

// ── Shared analyze form (used both before analysis and in re-evaluate mode) ──
const AnalyzeForm: React.FC<{
  selectedType: string;
  onTypeChange: (t: string) => void;
  customContext: string;
  onContextChange: (v: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  error: string | null;
  compact?: boolean;
}> = ({ selectedType, onTypeChange, customContext, onContextChange, onAnalyze, loading, error, compact }) => (
  <div className={`space-y-4 ${compact ? '' : ''}`}>
    {/* Call type selector */}
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

    {/* Context textarea */}
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
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
        {error}
      </div>
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
          מנתח... (עד 30 שניות)
        </span>
      ) : (
        '🔬 נתח שיחה'
      )}
    </button>
  </div>
);

const AnalysisView: React.FC<Props> = ({ callId, analysis, hasTranscript, onAnalysisComplete, onOpenTranscript }) => {
  const [selectedType, setSelectedType] = useState(analysis?.callType || 'new_prospect');
  const [customContext, setCustomContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReanalyze, setShowReanalyze] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
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

  // No transcript — can't analyze
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

  // Not yet analyzed — show full analyze form
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
          error={error}
        />
      </div>
    );
  }

  // Show analysis results
  return (
    <div className="space-y-4">
      {/* Header with call type + timestamp */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          סוג: {CALL_TYPES.find(ct => ct.id === analysis.callType)?.label || analysis.callType}
        </span>
        <span>{new Date(analysis.analyzedAt).toLocaleString('he-IL')}</span>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-100">
        <h4 className="text-xs font-bold text-cyan-700 mb-1.5 uppercase tracking-wider">סיכום</h4>
        <p className="text-sm text-slate-800 leading-relaxed">{analysis.summary}</p>
      </div>

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
          <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">טיוטת מייל מעקב</h4>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{analysis.email}</p>
            <button
              onClick={() => navigator.clipboard.writeText(analysis.email)}
              className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              📋 העתק
            </button>
          </div>
        </div>
      )}

      {/* CRM Note */}
      {analysis.crmNote && (
        <div>
          <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">הערת CRM</h4>
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-3 flex items-center justify-between">
            <p className="text-sm text-slate-700 font-medium">{analysis.crmNote}</p>
            <button
              onClick={() => navigator.clipboard.writeText(analysis.crmNote)}
              className="text-xs text-purple-500 hover:text-purple-600 font-medium flex-shrink-0 mr-3"
            >
              📋
            </button>
          </div>
        </div>
      )}

      {/* Re-analyze section */}
      <div className="pt-2 border-t border-slate-100">
        {!showReanalyze ? (
          <button
            onClick={() => {
              setSelectedType(analysis.callType || 'new_prospect');
              setCustomContext('');
              setShowReanalyze(true);
            }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            🔄 נתח מחדש עם הגדרות שונות
          </button>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700">🔄 ניתוח מחדש</h4>
              <button
                onClick={() => setShowReanalyze(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ביטול
              </button>
            </div>
            <AnalyzeForm
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              customContext={customContext}
              onContextChange={setCustomContext}
              onAnalyze={handleAnalyze}
              loading={loading}
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

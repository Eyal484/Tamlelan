import React from 'react';
import type { VoicenterInsights } from '../types';

interface Props {
  insights: VoicenterInsights | null | undefined;
}

const InsightsView: React.FC<Props> = ({ insights }) => {
  if (!insights) {
    return (
      <div className="text-center py-12 text-slate-400">
        <svg className="mx-auto mb-3 w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-lg">אין תובנות AI זמינות לשיחה זו</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {insights.summary && (
        <div className="bg-gradient-to-br from-slate-50 to-cyan-50 rounded-xl border border-cyan-100 p-5">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            סיכום שיחה
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed">{insights.summary}</p>
        </div>
      )}

      {/* Questions & Answers */}
      {insights.questions && insights.questions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ניתוח AI
          </h3>
          <div className="space-y-3">
            {insights.questions.map((q, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded">
                    {q.key}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-1.5">{q.question}</p>
                <div className="text-sm text-slate-800 font-medium">
                  {renderAnswer(q.answer, q.data_type)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participants */}
      {insights.participants && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            משתתפים
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <ParticipantCard
              role="מתקשר"
              name={insights.participants.caller?.name}
              traits={insights.participants.caller?.personality_traits}
              color="amber"
            />
            <ParticipantCard
              role="נציג"
              name={insights.participants.callee?.name}
              traits={insights.participants.callee?.personality_traits}
              color="cyan"
            />
          </div>
        </div>
      )}
    </div>
  );
};

function renderAnswer(answer: any, dataType: string): React.ReactNode {
  if (answer === null || answer === undefined) return <span className="text-slate-400">—</span>;

  if (typeof answer === 'boolean' || dataType === 'boolean') {
    const val = typeof answer === 'string' ? answer.toLowerCase() === 'true' : Boolean(answer);
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {val ? 'כן' : 'לא'}
      </span>
    );
  }

  if (Array.isArray(answer)) {
    if (answer.length === 0) return <span className="text-slate-400">—</span>;

    // Array of objects (like keywords with count)
    if (typeof answer[0] === 'object' && answer[0] !== null) {
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {answer.map((item, i) => (
            <span key={i} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-lg">
              {item.word || item.name || JSON.stringify(item)}
              {item.count !== undefined && <span className="text-slate-400 mr-1">({item.count})</span>}
            </span>
          ))}
        </div>
      );
    }

    // Array of strings
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {answer.map((item: string, i: number) => (
          <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
            {String(item)}
          </span>
        ))}
      </div>
    );
  }

  return <span>{String(answer)}</span>;
}

const ParticipantCard: React.FC<{
  role: string;
  name: string | null | undefined;
  traits: string[] | undefined;
  color: 'amber' | 'cyan';
}> = ({ role, name, traits, color }) => {
  const bgColor = color === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-cyan-50 border-cyan-200';
  const textColor = color === 'amber' ? 'text-amber-700' : 'text-cyan-700';

  return (
    <div className={`rounded-lg border p-3 ${bgColor}`}>
      <div className={`text-xs font-bold ${textColor} mb-1`}>{role}</div>
      <div className="text-sm font-semibold text-slate-800">{name || 'לא זוהה'}</div>
      {traits && traits.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {traits.map((t, i) => (
            <span key={i} className="text-[10px] bg-white/70 text-slate-600 px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default InsightsView;

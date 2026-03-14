import React, { useState, useRef, useEffect } from 'react';
import type { VoicenterTranscriptSentence, VoicenterEmotionSentence } from '../types';

interface Props {
  transcript: VoicenterTranscriptSentence[] | null | undefined;
  emotions?: VoicenterEmotionSentence[] | null;
  focusSentenceId?: number | null;
  aiHighlight?: string | null; // reason phrase from AI search to display as banner
}

function formatTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getEmotionBadge(emotion: string, direction: number): { label: string; className: string } {
  const emotionLabels: Record<string, string> = {
    frustrated: 'מתוסכל', helpful: 'מסייע', professional: 'מקצועי',
    cooperative: 'שיתופי', neutral: 'ניטרלי', appreciative: 'מעריך',
    thankful: 'אסיר תודה', patient: 'סבלני', hopeful: 'מקווה',
    empathetic: 'אמפתי', confident: 'בטוח', urgent: 'דחוף',
    agreeable: 'מסכים', efficient: 'יעיל', impatient: 'חסר סבלנות',
  };
  const label = emotionLabels[emotion.toLowerCase()] || emotion;
  let className = 'bg-slate-100 text-slate-600';
  if (direction === 1) className = 'bg-green-100 text-green-700';
  else if (direction === -1) className = 'bg-red-100 text-red-700';
  return { label, className };
}

const TranscriptView: React.FC<Props> = ({ transcript, emotions, focusSentenceId, aiHighlight }) => {
  const [activeSentenceId, setActiveSentenceId] = useState<number | null>(null);
  const [justActivatedId, setJustActivatedId] = useState<number | null>(null); // U4: pulse
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusSentenceId != null) {
      setActiveSentenceId(focusSentenceId);
      // U4: trigger pulse animation
      setJustActivatedId(focusSentenceId);
      setTimeout(() => setJustActivatedId(null), 800);
    }
  }, [focusSentenceId]);

  const emotionMap = new Map<number, VoicenterEmotionSentence>();
  if (emotions) {
    for (const em of emotions) emotionMap.set(em.sentence_id, em);
  }

  useEffect(() => {
    if (activeSentenceId !== null && containerRef.current) {
      const el = containerRef.current.querySelector(`[data-sid="${activeSentenceId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSentenceId]);

  if (!transcript || transcript.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <svg className="mx-auto mb-3 w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-lg">אין תמלול זמין לשיחה זו</p>
      </div>
    );
  }

  // Group consecutive sentences by speaker
  const groups: { speaker: string; sentences: VoicenterTranscriptSentence[] }[] = [];
  for (const sentence of transcript) {
    const last = groups[groups.length - 1];
    if (last && last.speaker === sentence.speaker) {
      last.sentences.push(sentence);
    } else {
      groups.push({ speaker: sentence.speaker, sentences: [sentence] });
    }
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {/* AI highlight banner */}
      {aiHighlight && (
        <div className="flex items-center gap-2 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-xl">
          <span className="text-sm">🤖</span>
          <span className="text-xs text-cyan-600 font-medium">רלוונטי לחיפוש:</span>
          <span className="text-xs text-cyan-700 italic">{aiHighlight}</span>
        </div>
      )}

      {groups.map((group, gi) => {
        const isRep = group.speaker === 'Speaker0';
        const speakerLabel = isRep ? 'נציג' : 'לקוח';
        const borderColor = isRep ? 'border-l-cyan-400' : 'border-l-amber-400';
        const badgeBg = isRep ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-50 text-amber-700';

        return (
          <div key={gi} className={`border-l-4 ${borderColor} bg-white rounded-lg p-3 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeBg}`}>{speakerLabel}</span>
              <span className="text-xs text-slate-400">
                {formatTime(group.sentences[0].startTime)}
                {group.sentences[group.sentences.length - 1].endTime !== null &&
                  ` - ${formatTime(group.sentences[group.sentences.length - 1].endTime)}`}
              </span>
            </div>

            <div className="space-y-1">
              {group.sentences.map(sentence => {
                const emotion = emotionMap.get(sentence.sentence_id);
                const isActive = activeSentenceId === sentence.sentence_id;
                const isPulsing = justActivatedId === sentence.sentence_id; // U4

                return (
                  <div
                    key={sentence.sentence_id}
                    data-sid={sentence.sentence_id}
                    onClick={() => {
                      const newActive = isActive ? null : sentence.sentence_id;
                      setActiveSentenceId(newActive);
                      if (newActive) {
                        setJustActivatedId(newActive);
                        setTimeout(() => setJustActivatedId(null), 800);
                      }
                    }}
                    className={`cursor-pointer rounded-lg px-2 py-1.5 transition-all duration-200 ${
                      isPulsing
                        ? 'bg-cyan-100 ring-2 ring-cyan-400 scale-[1.01]'
                        : isActive
                        ? 'bg-cyan-50 ring-1 ring-cyan-200'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm text-slate-700 leading-relaxed">{sentence.text}</span>
                    {emotion && emotion.emotion !== 'neutral' && (
                      <span className={`inline-block mr-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        getEmotionBadge(emotion.emotion, emotion.emotion_direction).className
                      }`}>
                        {getEmotionBadge(emotion.emotion, emotion.emotion_direction).label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TranscriptView;

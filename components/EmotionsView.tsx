import React from 'react';
import type { VoicenterEmotionSentence, VoicenterTranscriptSentence } from '../types';

interface Props {
  emotions: VoicenterEmotionSentence[] | null | undefined;
  transcript?: VoicenterTranscriptSentence[] | null;
}

const emotionLabels: Record<string, string> = {
  frustrated: 'מתוסכל',
  helpful: 'מסייע',
  professional: 'מקצועי',
  cooperative: 'שיתופי',
  neutral: 'ניטרלי',
  appreciative: 'מעריך',
  thankful: 'אסיר תודה',
  patient: 'סבלני',
  hopeful: 'מקווה',
  empathetic: 'אמפתי',
  confident: 'בטוח',
  urgent: 'דחוף',
  agreeable: 'מסכים',
  efficient: 'יעיל',
  impatient: 'חסר סבלנות',
};

const traitLabels: Record<string, string> = {
  impatient: 'חסר סבלנות',
  helpful: 'מסייע',
  professional: 'מקצועי',
  patient: 'סבלני',
  compliant: 'ציית',
  polite: 'מנומס',
  friendly: 'ידידותי',
  accommodating: 'מתחשב',
  understanding: 'מבין',
  'customer service oriented': 'שירותי',
};

function getEmotionColor(direction: number): string {
  if (direction === 1) return 'from-green-500 to-emerald-500';
  if (direction === -1) return 'from-red-500 to-rose-500';
  return 'from-slate-400 to-slate-500';
}

function getEmotionBg(direction: number): string {
  if (direction === 1) return 'bg-green-50 border-green-200';
  if (direction === -1) return 'bg-red-50 border-red-200';
  return 'bg-slate-50 border-slate-200';
}

const EmotionsView: React.FC<Props> = ({ emotions, transcript }) => {
  if (!emotions || emotions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <svg className="mx-auto mb-3 w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg">אין ניתוח רגשות זמין לשיחה זו</p>
      </div>
    );
  }

  // Build transcript map for text lookup
  const sentenceMap = new Map<number, VoicenterTranscriptSentence>();
  if (transcript) {
    for (const s of transcript) {
      sentenceMap.set(s.sentence_id, s);
    }
  }

  // Summary stats
  const positive = emotions.filter(e => e.emotion_direction === 1).length;
  const negative = emotions.filter(e => e.emotion_direction === -1).length;
  const neutral = emotions.filter(e => e.emotion_direction === 0).length;
  const total = emotions.length;

  // Group emotions by type for frequency chart
  const emotionCounts = new Map<string, number>();
  for (const e of emotions) {
    if (e.emotion !== 'neutral') {
      emotionCounts.set(e.emotion, (emotionCounts.get(e.emotion) || 0) + 1);
    }
  }
  const sortedEmotions = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-4">סקירת רגשות</h3>

        {/* Sentiment bar */}
        <div className="flex rounded-full overflow-hidden h-4 mb-4">
          {positive > 0 && (
            <div
              className="bg-gradient-to-l from-green-400 to-emerald-500 transition-all"
              style={{ width: `${(positive / total) * 100}%` }}
              title={`חיובי: ${positive}`}
            />
          )}
          {neutral > 0 && (
            <div
              className="bg-gradient-to-l from-slate-300 to-slate-400 transition-all"
              style={{ width: `${(neutral / total) * 100}%` }}
              title={`ניטרלי: ${neutral}`}
            />
          )}
          {negative > 0 && (
            <div
              className="bg-gradient-to-l from-red-400 to-rose-500 transition-all"
              style={{ width: `${(negative / total) * 100}%` }}
              title={`שלילי: ${negative}`}
            />
          )}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-green-600 font-medium">חיובי: {positive}</span>
          <span className="text-slate-500 font-medium">ניטרלי: {neutral}</span>
          <span className="text-red-600 font-medium">שלילי: {negative}</span>
        </div>
      </div>

      {/* Top emotions */}
      {sortedEmotions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-800 mb-3">רגשות מובילים</h3>
          <div className="flex flex-wrap gap-2">
            {sortedEmotions.map(([emotion, count]) => {
              const sample = emotions.find(e => e.emotion === emotion);
              const dir = sample?.emotion_direction || 0;
              return (
                <span
                  key={emotion}
                  className={`text-sm px-3 py-1.5 rounded-full font-medium border ${getEmotionBg(dir)}`}
                >
                  {emotionLabels[emotion.toLowerCase()] || emotion}
                  <span className="text-xs opacity-70 mr-1">({count})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Emotion timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-4">ציר זמן רגשי</h3>
        <div className="space-y-2">
          {emotions.filter(e => e.emotion !== 'neutral').map((em) => {
            const sentence = sentenceMap.get(em.sentence_id);
            return (
              <div key={em.sentence_id} className={`rounded-lg border p-3 ${getEmotionBg(em.emotion_direction)}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white bg-gradient-to-l ${getEmotionColor(em.emotion_direction)}`}>
                      {emotionLabels[em.emotion.toLowerCase()] || em.emotion}
                    </span>
                    {em.personality_trait && (
                      <span className="text-[10px] bg-white/80 text-slate-500 px-1.5 py-0.5 rounded">
                        {traitLabels[em.personality_trait.toLowerCase()] || em.personality_trait}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>ביטחון: {Math.round(em.confidence_emotion * 100)}%</span>
                    <span>עוצמה: {Math.round(em.intensity_emotion * 100)}%</span>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="flex gap-2 items-center mb-1.5">
                  <div className="flex-1 h-1.5 bg-white/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-l ${getEmotionColor(em.emotion_direction)}`}
                      style={{ width: `${em.intensity_emotion * 100}%` }}
                    />
                  </div>
                </div>

                {/* Sentence text */}
                {sentence && (
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      sentence.speaker === 'Speaker0' ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {sentence.speaker === 'Speaker0' ? 'נציג' : 'לקוח'}
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed">"{sentence.text}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmotionsView;

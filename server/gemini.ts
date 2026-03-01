import { GoogleGenAI } from '@google/genai';

// ============================================================
// Gemini Sales Analysis — Server-Side
// ============================================================

export interface ConversationTag {
  id: string;
  label: string;
  detected: boolean;
}

export interface KeyPoint {
  label: string;
  quote: string;
}

export interface GeminiAnalysis {
  summary: string;
  tags: ConversationTag[];
  keyPoints: KeyPoint[];
  email: string;
  crmNote: string;
  callType: string;
  analyzedAt: string; // ISO timestamp
  objectionType?: string; // F4: price | timing | competitor | not_relevant | needs_approval | none
}

const CALL_TYPE_INSTRUCTIONS: Record<string, string> = {
  performance_check: `
סוג שיחה: בדיקת ביצועים
שים לב במיוחד ל:
- מדדי ביצוע שהוזכרו (KPI)
- בעיות תפקוד או משמעת
- תגובת העובד לביקורת
- סיכומים והסכמות לפעולה
- האם הוצע תהליך שיפור?
`,
  renewal: `
סוג שיחה: חידוש עסקה / חידוש הסכם
שים לב במיוחד ל:
- האם הלקוח מעוניין לחדש
- תנאי העסקה (מחיר, תקופה, הנחות)
- השוואה לתנאים קודמים
- התנגדויות ופתרונות
- האם נסגרה עסקה
`,
  new_prospect: `
סוג שיחה: לקוח חדש / פרוספקט
שים לב במיוחד ל:
- מי הלקוח ומה הצורך שלו
- האם בוצע זיהוי צרכים (needs analysis)
- הצעת ערך — מה הוצע
- התנגדויות ותשובות
- צעדים הבאים (פגישה, הצעת מחיר, שליחת מידע)
`,
  follow_up: `
סוג שיחה: שיחת מעקב / follow-up
שים לב במיוחד ל:
- מה היה הנושא המקורי
- האם הלקוח קיבל מה שהובטח
- האם יש בעיה פתוחה
- מה הצעד הבא
- רמת שביעות רצון
`,
  reminder: `
סוג שיחה: תזכורת / ריענון
שים לב במיוחד ל:
- מה התזכורת (תשלום? פגישה? מסמך?)
- תגובת הלקוח
- האם נקבע מועד חדש
- נימת השיחה (ידידותית / לחוצה / עסקית)
`,
};

// ============================================================
// Main analysis function
// ============================================================

export async function analyzeTranscription(
  text: string,
  context?: string,
  callType?: string,
): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });

  const callTypeInstruction = callType && CALL_TYPE_INSTRUCTIONS[callType]
    ? CALL_TYPE_INSTRUCTIONS[callType]
    : '';

  const prompt = `אתה מנתח שיחות מכירה מקצועי בעברית. נתח את התמלול הבא:

${callTypeInstruction}

הנחיות:
1. סכם את השיחה ב-2-3 משפטים. אם הוזכרה שיחה/פגישה עתידית — ציין זאת בסיכום.
2. זהה תגיות (true/false):
   - self_intro: הנציג הציג עצמו ואת החברה
   - offer_sent: נשלחה/הוצגה הצעה
   - offer_followup: מעקב על הצעה קודמת
   - performance_issue: עלתה בעיית ביצועים/תפקוד
3. חלץ 3-5 נקודות מפתח עם ציטוט מדויק מהשיחה
4. כתוב טיוטת מייל מעקב קצרה (20-50 מילים)
5. כתוב הערת CRM שמתחילה תמיד ב-"מול [שם] — " ואחר כך 5-8 מילים.
   דוגמה: "מול מיכל — נסגרה חבילת 3 משרות ב-2250 ש"ח"
6. זהה סוג התנגדות עיקרית:
   price=מחיר, timing=תזמון, competitor=מתחרה, not_relevant=לא רלוונטי, needs_approval=צריך אישור, none=אין

${context ? `הקשר: ${context}` : ''}

תמלול:
${text}

ענה ב-JSON תקין בלבד.`;

  const responseSchema = {
    type: 'object' as const,
    properties: {
      summary: { type: 'string' as const },
      tags: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const },
            label: { type: 'string' as const },
            detected: { type: 'boolean' as const },
          },
          required: ['id', 'label', 'detected'],
        },
      },
      keyPoints: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            label: { type: 'string' as const },
            quote: { type: 'string' as const },
          },
          required: ['label', 'quote'],
        },
      },
      email: { type: 'string' as const },
      crmNote: { type: 'string' as const },
      objectionType: {
        type: 'string' as const,
        enum: ['price', 'timing', 'competitor', 'not_relevant', 'needs_approval', 'none'],
      },
    },
    required: ['summary', 'tags', 'keyPoints', 'email', 'crmNote', 'objectionType'],
  };

  console.log(`[Gemini] Analyzing (${text.length} chars, type: ${callType || 'general'})...`);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema },
  });

  const raw = response.text;
  if (!raw) throw new Error('Gemini returned empty response');

  const parsed = JSON.parse(raw);
  console.log(`[Gemini] Done: ${parsed.keyPoints?.length || 0} kp, ${parsed.tags?.length || 0} tags, objection: ${parsed.objectionType}`);

  return {
    summary: parsed.summary || '',
    tags: parsed.tags || [],
    keyPoints: parsed.keyPoints || [],
    email: parsed.email || '',
    crmNote: parsed.crmNote || '',
    objectionType: parsed.objectionType || 'none',
    callType: callType || 'general',
    analyzedAt: new Date().toISOString(),
  };
}

// ============================================================
// F9: Ask Gemini about a specific call
// ============================================================

export async function askAboutCall(
  transcriptText: string,
  question: string,
  context?: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `אתה עוזר AI שמנתח שיחות מכירה בעברית. ענה על השאלה הבאה רק בהתבסס על תמלול השיחה.
${context ? `הקשר: ${context}\n` : ''}
שאלה: ${question}

תמלול:
${transcriptText}

ענה בעברית בצורה ממוקדת (2-4 משפטים). אם אין מידע רלוונטי, אמור זאת.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
  });

  return response.text?.trim() || 'לא הצלחתי לענות על השאלה.';
}

// ============================================================
// F8: AI Semantic Search across calls
// ============================================================

export async function semanticSearch(
  query: string,
  calls: Array<{ id: string; text: string }>,
): Promise<string[]> {
  if (calls.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });

  const callsText = calls
    .slice(0, 80)
    .map(c => `[${c.id}]: ${c.text}`)
    .join('\n');

  const prompt = `מנוע חיפוש סמנטי לשיחות מכירה בעברית.

שאילתא: "${query}"

שיחות (מזהה: תיאור):
${callsText}

החזר רק מזהי שיחות רלוונטיות מופרדים בפסיקים. אם אין — החזר ריק.
ענה אך ורק עם המזהים.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
  });

  const raw = (response.text || '').trim();
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

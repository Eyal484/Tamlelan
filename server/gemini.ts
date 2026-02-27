import { GoogleGenAI } from '@google/genai';

// ============================================================
// Gemini Sales Analysis — Server-Side
// Analyzes plain-text transcripts from Voicenter calls
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
}

const CALL_TYPE_INSTRUCTIONS: Record<string, string> = {
  performance_check: `
סוג שיחה: בדיקת ביצועים
שים לב במיוחד ל:
- מדדי ביצוע שהוזכרו (KPI)
- בעיות תפקוד או משמעת
- תגובת העובד לביקורת
- סיכומים והסכמות לפעולה
- שאל/י: האם הוצע תהליך שיפור?
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

export async function analyzeTranscription(
  text: string,
  context?: string,
  callType?: string,
): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set in environment variables');
  }

  const ai = new GoogleGenAI({ apiKey });

  const callTypeInstruction = callType && CALL_TYPE_INSTRUCTIONS[callType]
    ? CALL_TYPE_INSTRUCTIONS[callType]
    : '';

  const prompt = `אתה מנתח שיחות מכירה מקצועי בעברית. נתח את התמלול הבא של שיחת מכירה/גיוס:

${callTypeInstruction}

הנחיות כלליות:
1. סכם את השיחה ב-2-3 משפטים
2. זהה את התגיות הבאות (true/false):
   - self_intro: האם הנציג הציג את עצמו ואת החברה
   - offer_sent: האם נשלחה/הוצגה הצעה
   - offer_followup: האם בוצע מעקב על הצעה קודמת
   - performance_issue: האם עלתה בעיית ביצועים/תפקוד
3. חלץ 3-5 נקודות מפתח עם ציטוט מדויק מהשיחה
4. כתוב טיוטת מייל מעקב קצרה (20-50 מילים)
5. כתוב הערת CRM תמציתית (5-12 מילים)

${context ? `הקשר נוסף: ${context}` : ''}

תמלול:
${text}

ענה אך ורק ב-JSON תקין, ללא טקסט נוסף.`;

  const responseSchema = {
    type: 'object' as const,
    properties: {
      summary: { type: 'string' as const, description: 'סיכום השיחה ב-2-3 משפטים' },
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
      email: { type: 'string' as const, description: 'טיוטת מייל מעקב' },
      crmNote: { type: 'string' as const, description: 'הערת CRM תמציתית' },
    },
    required: ['summary', 'tags', 'keyPoints', 'email', 'crmNote'],
  };

  console.log(`[Gemini] Analyzing transcript (${text.length} chars, type: ${callType || 'general'})...`);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  const raw = response.text;
  if (!raw) {
    throw new Error('Gemini returned empty response');
  }

  const parsed = JSON.parse(raw);
  console.log(`[Gemini] Analysis complete: ${parsed.keyPoints?.length || 0} key points, ${parsed.tags?.length || 0} tags`);

  return {
    summary: parsed.summary || '',
    tags: parsed.tags || [],
    keyPoints: parsed.keyPoints || [],
    email: parsed.email || '',
    crmNote: parsed.crmNote || '',
    callType: callType || 'general',
    analyzedAt: new Date().toISOString(),
  };
}

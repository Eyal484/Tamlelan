
import { GoogleGenAI, Type } from "@google/genai";
import { ConversationTag, KeyPoint } from "../types";

const TAGS_META = [
  { id: 'self_intro',         label: 'בצגב עצמית' },
  { id: 'offer_sent',         label: 'הוצגה הצעת מחיר' },
  { id: 'offer_followup',     label: 'בדיקה על הצעת מחיר' },
  { id: 'performance_issue',  label: 'בעיות בביצועים' },
];

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<{ text: string; summary: string; tags: ConversationTag[]; keyPoints: KeyPoint[] }> => {
  // Fix: Directly use process.env.API_KEY in the initialization as per SDK guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Step 1: Transcribe audio with extreme focus on accuracy
  const transcriptionPrompt = `אתה מהנדס תמלול מקצועי. המשימה היחידה שלך היא לתמלל את השיחה בדיוק מוחלט.

הנחיות קריטיות:
1. תמלל כל מילה שנאמרה - אל תדלג או תשנה מילים
2. שמות: היה מאוד זהיר עם שמות אנשים וחברות - כתוב בדיוק כמו שנשמע
3. מחירים ומספרים: כל סכום או מספר חייב להיות מדויק לחלוטין - זה קריטי!
4. תאריכים וזמנים: כתוב בצורה ברורה
5. אל תנסה לסכם או לתקן - רק תמלל
6. אם יש חלקים שלא ברורים, ציין [לא ברור] במקום להשמיץ

השתמש בשפה עברית או באנגלית לפי השיחה.

החזר רק את התמלול, בתוך JSON:
{
  "text": "התמלול המלא כאן..."
}`;

  // Step 2: Summarize the transcribed text with tag detection and key points
  const summaryPrompt = (transcribedText: string) => `אתה עוזר מקצועי לניתוח שיחות מכירות עבור דרושים IL (אתר מודעות עבודה בישראל). על בסיס התמלול שלהלן, ספק סיכום מדויק, זהה אירועי שיחה וחלץ נקודות חשובות.

התמלול:
${transcribedText}

סיכום יוקד על:
- שמות הלקוח והמוכר (מהתמלול)
- חבילות משרות/שירותים שנדונו ומחיריהן
- מחירים ותנאים בדיוק כמו בשיחה
- החלטה סופית וסטטוס העסקה
- צעדים הבאים
- כל תנאי מיוחד או מוגבלות

אירועי שיחה שיש לזהות:
- self_intro: הלקוח או המוכר הציגו את עצמם (בצגב עצמית)
- offer_sent: נשלחה או הוצגה הצעת מחיר (הוצגה הצעת מחיר)
- offer_followup: עוקבים על הצעת מחיר קודמת (בדיקה על הצעת מחיר)
- performance_issue: הלקוח התלונן על כמות מועמדים או בעיות בביצועים (בעיות בביצועים)

נקודות חשובות: חלץ עד 5 נקודות חזוקות מהשיחה (כמו חבילות משרות, מחירים, החלטות). עבור כל נקודה, ספק את התווית (label) וציטוט מדויק מהתמלול (quote) שמתאים לנקודה זו.

החזר את הנתונים בתוך JSON:
{
  "summary": "סיכום מכירות כאן...",
  "tags": {
    "self_intro": true/false,
    "offer_sent": true/false,
    "offer_followup": true/false,
    "performance_issue": true/false
  },
  "key_points": [
    { "label": "חבילת 10 משרות ב-4000₪", "quote": "exact quote from transcript" }
  ]
}`;

  try {
    // Step 1: Transcribe
    const transcriptionResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: transcriptionPrompt },
            {
              inlineData: {
                data: base64Audio,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING }
          },
          required: ["text"]
        }
      }
    });

    const transcriptionResult = JSON.parse(transcriptionResponse.text || "{}");
    const transcribedText = transcriptionResult.text || "לא ניתן היה להפיק תמלול.";

    // Step 2: Summarize the transcribed text
    const summaryResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: summaryPrompt(transcribedText) }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tags: {
              type: Type.OBJECT,
              properties: {
                self_intro: { type: Type.BOOLEAN },
                offer_sent: { type: Type.BOOLEAN },
                offer_followup: { type: Type.BOOLEAN },
                performance_issue: { type: Type.BOOLEAN }
              },
              required: ["self_intro", "offer_sent", "offer_followup", "performance_issue"]
            },
            key_points: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  quote: { type: Type.STRING }
                },
                required: ["label", "quote"]
              }
            }
          },
          required: ["summary", "tags", "key_points"]
        }
      }
    });

    const summaryResult = JSON.parse(summaryResponse.text || "{}");
    const summary = summaryResult.summary || "לא ניתן היה להפיק סיכום.";

    // Map tags object to ConversationTag[]
    const tagsObj = summaryResult.tags || {};
    const tags: ConversationTag[] = TAGS_META.map(meta => ({
      id: meta.id,
      label: meta.label,
      detected: tagsObj[meta.id] || false
    }));

    // Map key_points to KeyPoint[]
    const keyPoints: KeyPoint[] = (summaryResult.key_points || []).map((kp: any) => ({
      label: kp.label || "",
      quote: kp.quote || ""
    }));

    return {
      text: transcribedText,
      summary: summary,
      tags: tags,
      keyPoints: keyPoints
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error("נכשלה פעולת התמלול. וודא שקובץ האודיו תקין.");
  }
};

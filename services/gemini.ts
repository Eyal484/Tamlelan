
import { GoogleGenAI, Type } from "@google/genai";

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<{ text: string; summary: string }> => {
  // Fix: Directly use process.env.API_KEY in the initialization as per SDK guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `אתה עוזר מקצועי לתימלול שיחות מכירות.
אנא תמלל את השיחה המצורפת בצורה מדויקת ופרטנית.
הקפד על דיוק מוחלט בשמות של אנשים, שמות חברות, מספרים, מחירים, סכומים וגם תאריכים.

לאחר מכן, ספק סיכום ממוקד על מכירות המדגיש:
- שמות הלקוח והמוכר (חשוב מאוד)
- מוצרים/שירותים שנדונו
- מחירים ותנאים (מספרים חשובים)
- החלטה סופית וסטטוס העסקה
- צעדים הבאים
- כל תנאי מיוחד או מוגבלות

השתמש בשפה שבה נוהלה השיחה (כנראה עברית).
נא להיות מדויק במיוחד בשמות ובמספרים - זה קריטי!

אנא החזר את התשובה בפורמט JSON הבא:
{
  "text": "התמלול המלא כאן...",
  "summary": "סיכום מכירות - שמות, מחירים, החלטות"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
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
            text: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: ["text", "summary"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      text: result.text || "לא ניתן היה להפיק תמלול.",
      summary: result.summary || "לא ניתן היה להפיק סיכום."
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error("נכשלה פעולת התמלול. וודא שקובץ האודיו תקין.");
  }
};

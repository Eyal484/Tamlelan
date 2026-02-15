
import { GoogleGenAI, Type } from "@google/genai";

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<{ text: string; summary: string }> => {
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

  // Step 2: Summarize the transcribed text
  const summaryPrompt = (transcribedText: string) => `אתה עוזר מקצועי לניתוח שיחות מכירות. על בסיס התמלול שלהלן, ספק סיכום מדויק.

התמלול:
${transcribedText}

סיכום יוקד על:
- שמות הלקוח והמוכר (מהתמלול)
- מוצרים/שירותים שנדונו
- מחירים ותנאים בדיוק כמו בשיחה
- החלטה סופית וסטטוס העסקה
- צעדים הבאים
- כל תנאי מיוחד או מוגבלות

המשימה שלך היא לחלץ את המידע החשוב ביותר בצורה ברורה ומדויקת.

החזר את הסיכום בתוך JSON:
{
  "summary": "סיכום מכירות כאן..."
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
            summary: { type: Type.STRING }
          },
          required: ["summary"]
        }
      }
    });

    const summaryResult = JSON.parse(summaryResponse.text || "{}");
    const summary = summaryResult.summary || "לא ניתן היה להפיק סיכום.";

    return {
      text: transcribedText,
      summary: summary
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error("נכשלה פעולת התמלול. וודא שקובץ האודיו תקין.");
  }
};

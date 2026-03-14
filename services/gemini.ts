import { GoogleGenAI } from '@google/genai';
import { ConversationTag, KeyPoint } from '../types';

const ASHKELON_URL = 'http://localhost:9000/api/ashkelon/request';

async function getGeminiKey(): Promise<string> {
    try {
        const response = await fetch(ASHKELON_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: 'tamlelan',
                type: 'GEMINI_API_KEY',
                purpose: 'Real-time sales call transcription and analysis'
            })
        });
        const data = await response.json();
        if (data.success && data.key) return data.key;
        throw new Error(data.error || 'Failed to fetch key from Ashkelon');
    } catch (err) {
        console.warn('Ashkelon key request failed, falling back to environment variables:', err);
        // Fallback to various possible env var names for robustness
        return (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.GEMINI_API_KEY || '';
    }
}

export const transcribeAudioGemini = async (blob: Blob, mimeType: string, dualAudioMode: boolean = false): Promise<string> => {
    const key = await getGeminiKey();
    if (!key) throw new Error("No API Key available for transcription");

    const genAI = new GoogleGenAI({ apiKey: key });
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert blob to base64
    const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
    });

    const result = await model.generateContent([
        {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        },
        { text: "אנא תמלל את האודיו הזה לעברית. אם מדובר בשיחת מכירה, הפרד בין הדוברים אם ניתן." }
    ]);

    return result.response.text();
};

export const analyzeTranscription = async (text: string, context?: string, callType?: string): Promise<{
    summary: string;
    tags: ConversationTag[];
    keyPoints: KeyPoint[];
    email: string;
    crmNote: string;
}> => {
    const key = await getGeminiKey();
    if (!key) throw new Error("No API Key available for analysis");

    const genAI = new GoogleGenAI({ apiKey: key });
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `אתה מנתח שיחות מכירה מקצועי בעברית. נתח את התמלול הבא:

הקשר עסקי: ${context || 'שיחת מכירה כללית'}
סוג שיחה מבוקש: ${callType || 'כללי'}

הנחיות:
1. סכם את השיחה ב-2-3 משפטים.
2. זהה תגיות (true/false): self_intro, offer_sent, offer_followup, objection_raised.
3. חלץ 3 נקודות מפתח עם ציטוט מדויק.
4. כתוב טיוטת מייל מעקב קצרה.
5. כתוב הערת CRM קצרה.

תמלול:
${text}

ענה בפורמט JSON בלבד:
{
  "summary": "...",
  "tags": [{"id": "self_intro", "label": "הצגה עצמית", "detected": true}, ...],
  "keyPoints": [{"label": "נושא", "quote": "..."}],
  "email": "...",
  "crmNote": "..."
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);
};

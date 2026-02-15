
export const transcribeAudioOpenAI = async (blob: Blob, mimeType: string): Promise<string> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("מפתח OpenAI API חסר. הוסף OPENAI_API_KEY ל-.env.local");

  // Strip codec suffix: 'audio/webm;codecs=opus' → 'webm'
  const extension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
  const file = new File([blob], `audio.${extension}`, { type: mimeType });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'gpt-4o-mini-transcribe');
  formData.append('language', 'he');
  formData.append('timestamp_granularities', 'segment');

  // CRITICAL: Do NOT set Content-Type header — fetch sets it automatically
  // with the correct multipart boundary when body is FormData
  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`שגיאת OpenAI (${response.status}): ${errorBody}`);
    }
    const data = await response.json();
    return data.text || "לא ניתן היה להפיק תמלול.";
  } catch (error) {
    console.error("OpenAI transcription error:", error);
    if (error instanceof Error && error.message.includes("OpenAI")) {
      throw error;
    }
    throw new Error("נכשלה פעולת התמלול עם OpenAI Whisper.");
  }
};

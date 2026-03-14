import React, { useState } from 'react';
import { AppState, TranscriptionResult } from '../../types';
import { transcribeAudioGemini, analyzeTranscription } from '../../services/gemini';
import { useCallHistory } from './useCallHistory';

export const useTranscription = ({
    setStatus,
    setErrorMessage,
    setTranscribedText,
    setResult,
    setLastFailedOperation,
    addEntry
}: {
    setStatus: React.Dispatch<React.SetStateAction<AppState>>;
    setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
    setTranscribedText: React.Dispatch<React.SetStateAction<string | null>>;
    setResult: React.Dispatch<React.SetStateAction<TranscriptionResult | null>>;
    setLastFailedOperation: React.Dispatch<React.SetStateAction<{ type: string; data?: any } | null>>;
    addEntry: ReturnType<typeof useCallHistory>['addEntry'];
}) => {
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setErrorMessage(null);
        setStatus(AppState.PROCESSING);
        try {
            const text = await transcribeAudioGemini(file, file.type, false);
            setTranscribedText(text);
            setStatus(AppState.TRANSCRIBED);
        } catch (err: any) {
            setErrorMessage(err.message || "שגיאה בתמלול");
            setStatus(AppState.ERROR);
        }
        e.target.value = '';
    };

    const handleTranscribe = async (audioBlob: Blob | null, dualAudioMode: boolean) => {
        if (!audioBlob) return;
        setErrorMessage(null);
        setStatus(AppState.PROCESSING);
        try {
            const text = await transcribeAudioGemini(audioBlob, 'audio/webm', dualAudioMode);
            setTranscribedText(text);
            setStatus(AppState.TRANSCRIBED);
            setLastFailedOperation(null);
        } catch (err: any) {
            let message = "שגיאה בתמלול";
            if (err.message.includes('network')) {
                message = "בעיית חיבור. בדוק את החיבור לאינטרנט.";
            } else if (err.message.includes('timeout')) {
                message = "הבקשה הלכה לזמן. נסה שוב בעוד דקה.";
            } else if (err.message.includes('format')) {
                message = "קובץ אודיו לא תקין. נסה בפורמט שונה.";
            }
            setErrorMessage(message);
            setStatus(AppState.ERROR);
            setLastFailedOperation({ type: 'transcribe' });
        }
    };

    const handleAnalyze = async (
        transcribedText: string | null,
        recordingContext: string,
        selectedCallType: string | null,
        timer: number
    ) => {
        if (!transcribedText) return;
        setStatus(AppState.ANALYZING);
        try {
            const analysis = await analyzeTranscription(transcribedText, recordingContext, selectedCallType || undefined);

            setResult({
                text: transcribedText,
                summary: analysis.summary,
                language: 'he',
                timestamp: new Date().toISOString(),
                tags: analysis.tags,
                keyPoints: analysis.keyPoints,
                context: recordingContext || undefined,
                callType: selectedCallType || undefined,
                email: analysis.email,
                crmNote: analysis.crmNote
            });

            const success = addEntry({
                id: crypto.randomUUID(),
                text: transcribedText,
                summary: analysis.summary,
                language: 'he',
                timestamp: new Date().toISOString(),
                duration: timer,
                tags: analysis.tags,
                keyPoints: analysis.keyPoints,
                context: recordingContext || undefined,
                callType: selectedCallType || undefined,
                crmNote: analysis.crmNote
            });

            if (!success) {
                setErrorMessage("זיכרון התקן מלא. לא ניתן לשמור את ההקלטה.");
                setStatus(AppState.ERROR);
                return;
            }

            setStatus(AppState.RESULT);
            setLastFailedOperation(null);
        } catch (err: any) {
            let message = "שגיאה בניתוח";
            if (err.message.includes('network')) {
                message = "בעיית חיבור. בדוק את החיבור לאינטרנט.";
            } else if (err.message.includes('timeout')) {
                message = "הבקשה הלכה לזמן. נסה שוב בעוד דקה.";
            }
            setErrorMessage(message);
            setStatus(AppState.ERROR);
            setLastFailedOperation({ type: 'analyze' });
        }
    };

    return {
        handleFileUpload,
        handleTranscribe,
        handleAnalyze
    };
};

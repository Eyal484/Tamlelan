import React, { useRef, useState } from 'react';
import { AppState } from '../../types';

export const useAudioRecorder = ({
    dualAudioMode,
    setStatus,
    setTimer,
    setErrorMessage,
    setAudioBlob,
    setAudioUrl
}: {
    dualAudioMode: boolean;
    setStatus: React.Dispatch<React.SetStateAction<AppState>>;
    setTimer: React.Dispatch<React.SetStateAction<number>>;
    setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
    setAudioBlob: React.Dispatch<React.SetStateAction<Blob | null>>;
    setAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
}) => {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const intervalRef = useRef<number | null>(null);

    const startRecording = async () => {
        try {
            setErrorMessage(null);
            audioChunksRef.current = [];

            let combinedStream: MediaStream;

            if (dualAudioMode) {
                try {
                    // Try to capture system audio (other party in call) via display media
                    const displayStream = await navigator.mediaDevices.getDisplayMedia({
                        video: { width: 1, height: 1 } as any,
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    } as any);

                    // Also capture microphone (your voice)
                    const micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: true
                        }
                    });

                    // Merge both streams using Web Audio API
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const dest = audioCtx.createMediaStreamDestination();

                    const source1 = audioCtx.createMediaStreamSource(displayStream);
                    const source2 = audioCtx.createMediaStreamSource(micStream);

                    source1.connect(dest);
                    source2.connect(dest);

                    combinedStream = dest.stream;
                } catch (e) {
                    console.warn("Could not capture system audio, falling back to microphone only.", e);
                    combinedStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });
                }
            } else {
                // Microphone only mode
                combinedStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            }

            const recorder = new MediaRecorder(combinedStream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                setStatus(AppState.RECORDED);
            };

            recorder.start();
            setStatus(AppState.RECORDING);
            setTimer(0);

            intervalRef.current = window.setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);

        } catch (err: any) {
            console.error(err);
            setErrorMessage("לא ניתן היה להתחיל הקלטה. וודא שנתת הרשאות מתאימות.");
            setStatus(AppState.ERROR);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
            audioChunksRef.current = [];
        }
    };

    return {
        startRecording,
        stopRecording,
        cancelRecording
    };
};

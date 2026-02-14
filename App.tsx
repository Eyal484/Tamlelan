
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, TranscriptionResult } from './types';
import { transcribeAudio } from './services/gemini';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [timer, setTimer] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Fix: Using number instead of NodeJS.Timeout for browser-based React application
  const intervalRef = useRef<number | null>(null);

  // Helper to convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      audioChunksRef.current = [];
      
      // We try to capture both Mic and System Audio.
      // Note: "System Audio" capture via getDisplayMedia is OS/Browser dependent.
      // On Chrome/Windows, the user can select a tab or screen and check "Share audio".
      
      let combinedStream: MediaStream;
      
      try {
        // Request Display Media for "System Audio" (the other side of the call)
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1, height: 1 }, // Required for some browsers
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        } as any);

        // Request Microphone
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Merge them using AudioContext
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        
        const source1 = audioCtx.createMediaStreamSource(displayStream);
        const source2 = audioCtx.createMediaStreamSource(micStream);
        
        source1.connect(dest);
        source2.connect(dest);
        
        combinedStream = dest.stream;
      } catch (e) {
        console.warn("Could not capture system audio, falling back to microphone only.", e);
        combinedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const recorder = new MediaRecorder(combinedStream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setStatus(AppState.PROCESSING);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          const base64 = await blobToBase64(audioBlob);
          const transcription = await transcribeAudio(base64, 'audio/webm');
          
          setResult({
            text: transcription.text,
            summary: transcription.summary,
            language: 'he',
            timestamp: new Date().toLocaleTimeString()
          });
          setStatus(AppState.RESULT);
        } catch (err: any) {
          setErrorMessage(err.message || "שגיאה בתמלול");
          setStatus(AppState.ERROR);
        }
      };

      recorder.start();
      setStatus(AppState.RECORDING);
      setTimer(0);
      // Fix: Explicitly use window.setInterval for consistent return type in browser
      intervalRef.current = window.setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setErrorMessage("לא ניתן היה להתחיל הקלטה. וודא שנתת הרשאות מתאימות.");
      setStatus(AppState.ERROR);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === AppState.RECORDING) {
      mediaRecorderRef.current.stop();
      // Fix: Explicitly use window.clearInterval
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      // Stop all tracks to release hardware
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setStatus(AppState.IDLE);
    setResult(null);
    setErrorMessage(null);
    setTimer(0);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-50">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-indigo-700 mb-2">CallTranscribe Pro</h1>
        <p className="text-gray-600">הפוך שיחות לטקסט וסיכומים בקליק</p>
      </header>

      <main className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 transition-all">
        
        {/* Status Display */}
        <div className="flex flex-col items-center justify-center space-y-6">
          
          {status === AppState.IDLE && (
            <div className="text-center space-y-6">
              <div className="bg-indigo-50 p-6 rounded-lg text-indigo-800 text-sm border border-indigo-100">
                <p className="font-semibold mb-2">הנחיות להקלטת שיחה:</p>
                <ul className="list-disc list-inside text-right space-y-1">
                  <li>לחץ על "התחל הקלטה"</li>
                  <li>אם תתבקש, בחר את המסך/טאב בו מתבצעת השיחה</li>
                  <li>סמן את התיבה <strong>"שתף שמע של המערכת"</strong> כדי להקליט גם את הצד השני</li>
                </ul>
              </div>
              <button 
                onClick={startRecording}
                className="group relative flex items-center justify-center w-24 h-24 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-all shadow-lg hover:shadow-indigo-200 active:scale-95 mx-auto"
              >
                <div className="absolute inset-0 rounded-full border-4 border-indigo-200 group-hover:scale-110 transition-transform"></div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              <p className="font-semibold text-lg text-gray-700">התחל הקלטה</p>
            </div>
          )}

          {status === AppState.RECORDING && (
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-ping mr-2"></div>
                <span className="text-2xl font-mono font-bold text-gray-800">{formatTime(timer)}</span>
              </div>
              <button 
                onClick={stopRecording}
                className="flex items-center justify-center w-24 h-24 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-lg active:scale-95 mx-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
              <p className="font-semibold text-lg text-gray-700">סיים הקלטה ותמלל</p>
            </div>
          )}

          {status === AppState.PROCESSING && (
            <div className="text-center space-y-4 py-8">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
              <h2 className="text-xl font-bold text-gray-800">מעבד את השיחה...</h2>
              <p className="text-gray-500">Gemini AI מנתח את האודיו ומייצר תמלול וסיכום</p>
            </div>
          )}

          {status === AppState.RESULT && result && (
            <div className="w-full space-y-6 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">תוצאות התמלול</h2>
                <button 
                  onClick={reset}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  הקלטה חדשה
                </button>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">סיכום המפגש</h3>
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-900 leading-relaxed">
                  {result.summary}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">תמלול מלא</h3>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto custom-scrollbar">
                  {result.text}
                </div>
              </section>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => navigator.clipboard.writeText(`${result.summary}\n\n${result.text}`)}
                  className="flex-1 py-3 px-4 bg-gray-800 hover:bg-black text-white rounded-lg font-bold transition-colors"
                >
                  העתק הכל
                </button>
                <button 
                  onClick={() => window.print()}
                  className="flex-1 py-3 px-4 border border-gray-300 hover:bg-gray-100 rounded-lg font-bold transition-colors"
                >
                  הדפס / שמור כ-PDF
                </button>
              </div>
            </div>
          )}

          {status === AppState.ERROR && (
            <div className="text-center space-y-4 py-8">
              <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-100 max-w-sm">
                <p className="font-bold mb-1">אופס! משהו השתבש</p>
                <p className="text-sm">{errorMessage}</p>
              </div>
              <button 
                onClick={reset}
                className="py-2 px-6 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-colors"
              >
                נסה שוב
              </button>
            </div>
          )}

        </div>
      </main>

      <footer className="mt-8 text-gray-400 text-xs">
        &copy; {new Date().getFullYear()} CallTranscribe Pro - Powered by Gemini AI
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
};

export default App;

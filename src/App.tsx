import React, { useState, useRef, useEffect } from 'react';
import { AppState, TranscriptionResult } from '../types';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useCallHistory } from './hooks/useCallHistory';
import { useTranscription } from './hooks/useTranscription';
import { HistoryPanel } from './components/HistoryPanel';
import { EntryDetailView } from './components/EntryDetailView';
import { RecordingPanel } from './components/RecordingPanel';

const App: React.FC = () => {
    const [status, setStatus] = useState<AppState>(AppState.IDLE);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [result, setResult] = useState<TranscriptionResult | null>(null);
    const [timer, setTimer] = useState(0);
    const [showHistory, setShowHistory] = useState(false);
    const [transcribedText, setTranscribedText] = useState<string | null>(null);
    const [dualAudioMode, setDualAudioMode] = useState<boolean>(false);
    const [recordingContext, setRecordingContext] = useState<string>('');
    const [showContextInput, setShowContextInput] = useState<boolean>(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [selectedCallType, setSelectedCallType] = useState<string | null>(null);
    const [lastFailedOperation, setLastFailedOperation] = useState<{ type: string; data?: any } | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Custom Hooks
    const {
        history,
        viewingEntry,
        setViewingEntry,
        deleteEntry,
        addEntry,
        updateEntryCallType,
        exportHistoryAsCSV,
        formatDate
    } = useCallHistory();

    const { startRecording, stopRecording, cancelRecording } = useAudioRecorder({
        dualAudioMode,
        setStatus,
        setTimer,
        setErrorMessage,
        setAudioBlob,
        setAudioUrl
    });

    const { handleFileUpload, handleTranscribe, handleAnalyze } = useTranscription({
        setStatus,
        setErrorMessage,
        setTranscribedText,
        setResult,
        setLastFailedOperation,
        addEntry
    });

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isEditable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';

            if (e.key === 'Enter' && status === AppState.IDLE && !isEditable) {
                e.preventDefault();
                startRecording();
            }

            if (e.key === 'Escape' && status === AppState.RECORDING) {
                e.preventDefault();
                cancelRecording();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status, startRecording, cancelRecording]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const reset = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setStatus(AppState.IDLE);
        setResult(null);
        setErrorMessage(null);
        setTimer(0);
        setTranscribedText(null);
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingContext('');
        setShowContextInput(false);
        setLastFailedOperation(null);
        setSelectedCallType(null);
    };

    const retryLastOperation = async () => {
        if (!lastFailedOperation) return;
        if (lastFailedOperation.type === 'transcribe' && audioBlob) {
            await handleTranscribe(audioBlob, dualAudioMode);
        } else if (lastFailedOperation.type === 'analyze' && transcribedText) {
            await handleAnalyze(transcribedText, recordingContext, selectedCallType, timer);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <header className="mb-12 w-full max-w-2xl flex justify-between items-center">
                <div className="text-center flex-1">
                    <h1 className="text-5xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Tamlelan</h1>
                </div>
                <button
                    onClick={() => {
                        setShowHistory(!showHistory);
                        setViewingEntry(null);
                    }}
                    className="absolute right-8 top-8 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold text-white transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-cyan-500/20"
                >
                    📋 {history.length}
                </button>
            </header>

            <main className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl p-8 transition-all border border-slate-700/50">

                {showHistory && !viewingEntry && (
                    <HistoryPanel
                        history={history}
                        setShowHistory={setShowHistory}
                        setViewingEntry={setViewingEntry}
                        deleteEntry={deleteEntry}
                        exportHistoryAsCSV={exportHistoryAsCSV}
                        setErrorMessage={setErrorMessage}
                        formatDate={formatDate}
                    />
                )}

                {viewingEntry && (
                    <EntryDetailView
                        viewingEntry={viewingEntry}
                        setViewingEntry={setViewingEntry}
                        deleteEntry={deleteEntry}
                        updateEntryCallType={updateEntryCallType}
                        formatDate={formatDate}
                    />
                )}

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileUpload}
                />

                {!showHistory && !viewingEntry && (
                    <RecordingPanel
                        status={status}
                        dualAudioMode={dualAudioMode}
                        setDualAudioMode={setDualAudioMode}
                        showContextInput={showContextInput}
                        setShowContextInput={setShowContextInput}
                        recordingContext={recordingContext}
                        setRecordingContext={setRecordingContext}
                        selectedCallType={selectedCallType}
                        setSelectedCallType={setSelectedCallType}
                        timer={timer}
                        formatTime={formatTime}
                        errorMessage={errorMessage}
                        transcribedText={transcribedText}
                        result={result}
                        audioUrl={audioUrl}
                        startRecording={startRecording}
                        stopRecording={stopRecording}
                        cancelRecording={() => { cancelRecording(); reset(); }}
                        handleTranscribe={() => handleTranscribe(audioBlob, dualAudioMode)}
                        handleAnalyze={() => handleAnalyze(transcribedText, recordingContext, selectedCallType, timer)}
                        retryLastOperation={retryLastOperation}
                        reset={reset}
                        fileInputRef={fileInputRef}
                    />
                )}
            </main>
        </div>
    );
};

export default App;

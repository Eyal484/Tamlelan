
export interface TranscriptionResult {
  text: string;
  summary?: string;
  language: string;
  timestamp: string;
}

export interface HistoryEntry {
  id: string;
  text: string;
  summary: string;
  language: string;
  timestamp: string;
  duration: number;
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}

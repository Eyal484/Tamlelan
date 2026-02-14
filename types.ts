
export interface TranscriptionResult {
  text: string;
  summary?: string;
  language: string;
  timestamp: string;
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}

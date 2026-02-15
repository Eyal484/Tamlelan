
export interface ConversationTag {
  id: string;
  label: string;
  detected: boolean;
}

export interface KeyPoint {
  label: string;
  quote: string;
}

export interface TranscriptionResult {
  text: string;
  summary?: string;
  language: string;
  timestamp: string;
  tags?: ConversationTag[];
  keyPoints?: KeyPoint[];
}

export interface HistoryEntry {
  id: string;
  text: string;
  summary: string;
  language: string;
  timestamp: string;
  duration: number;
  tags?: ConversationTag[];
  keyPoints?: KeyPoint[];
}

export type TranscriptionModel = 'gemini' | 'openai';

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  TRANSCRIBED = 'TRANSCRIBED',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}

// Re-export Voicenter types for frontend use
export type {
  VoicenterCall,
  VoicenterAIData,
  VoicenterTranscriptSentence,
  VoicenterInsights,
  VoicenterQuestion,
  VoicenterParticipants,
  VoicenterParticipantInfo,
  VoicenterEmotions,
  VoicenterEmotionSentence,
  VoicenterIVRLayer,
  CallListItem,
  GeminiAnalysis,
} from './server/types';

// Frontend-only types
export type CallDetailTab = 'transcript' | 'insights' | 'emotions' | 'metadata' | 'analysis';

export enum AppState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PROCESSING = 'processing',
  TRANSCRIBED = 'transcribed',
  ANALYZING = 'analyzing',
  RESULT = 'result',
  ERROR = 'error'
}

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
  summary: string;
  language: string;
  timestamp: string;
  tags: ConversationTag[];
  keyPoints: KeyPoint[];
  context?: string;
  callType?: string;
  email?: string;
  crmNote?: string;
}

export interface HistoryEntry extends TranscriptionResult {
  id: string;
  duration: number;
}

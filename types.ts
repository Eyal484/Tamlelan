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
} from './server/types';

// Frontend-only types
export type CallDetailTab = 'transcript' | 'insights' | 'emotions' | 'metadata';

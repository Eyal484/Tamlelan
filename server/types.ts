// ============================================================
// Voicenter Webhook Types
// ============================================================

// --- Transcript ---

export interface VoicenterTranscriptSentence {
  speaker: string;       // "Speaker0" = representative, "Speaker1" = customer
  text: string;
  startTime: number;
  endTime: number | null;
  sentence_id: number;
}

// --- AI Insights ---

export interface VoicenterQuestion {
  key: string;
  question: string;
  data_type: string;
  answer: any;
}

export interface VoicenterParticipantInfo {
  name: string | null;
  personality_traits: string[];
}

export interface VoicenterParticipants {
  caller: VoicenterParticipantInfo;
  callee: VoicenterParticipantInfo;
}

export interface VoicenterInsights {
  questions: VoicenterQuestion[];
  participants: VoicenterParticipants;
  summary: string;
}

// --- Emotions ---

export interface VoicenterEmotionSentence {
  sentence_id: number;
  emotion: string;
  emotion_direction: number;   // 1 = positive, -1 = negative, 0 = neutral
  confidence_emotion: number;
  intensity_emotion: number;
  personality_trait: string | null;
  confidence_trait: number;
}

export interface VoicenterEmotions {
  questions: any[];
  sentences: VoicenterEmotionSentence[];
}

// --- AI Data (wrapper) ---

export interface VoicenterAIData {
  insights: VoicenterInsights | null;
  emotions: VoicenterEmotions | null;
  transcript: VoicenterTranscriptSentence[] | null;
}

// --- IVR Layer ---

export interface VoicenterIVRLayer {
  layer_id: number;
  layer_name: string;
  layer_number: number;
  Dtmf: number;
  dtmf_order: number;
}

// --- Dialer Data ---

export interface VoicenterDialerData {
  CampaignID: number;
  CampaignTypeID: number;
  CampaignTypeName: string;
  CallID: string;
  StatusName: string;
  Phone: string;
  CallInserted: string;
  RetryNum: number;
  RetryAmount: number;
}

// --- Main Call Payload ---

export interface VoicenterCall {
  // Core fields
  ivruniqueid: string;
  caller: string;
  target: string;
  time: number;
  duration: number;
  type: string;
  status: string;
  direction?: string;

  // Extension/DID info
  did: string;
  targetextension: string;
  callerextension: string;
  targetextension_name?: string;
  callerextension_name?: string;
  extenUser?: string;
  callerPhone?: string;

  // Answer & timing
  isAnswer?: number;
  actualCallDuration?: number;
  actualCallDialtime?: number;
  dialtime?: number;

  // Queue
  queueid: number;
  queuename: string;
  seconds_waiting_in_queue?: number;

  // Representative
  representative_name?: string;
  representative_code?: string;

  // Recording
  record: string;

  // Price
  price?: number;

  // Country
  target_country?: string;
  caller_country?: string;

  // Department
  DepartmentID?: number;
  DepartmentName?: string;
  TopDepartmentID?: number;
  TopDepartmentName?: string;

  // IVR routing
  IVR?: VoicenterIVRLayer[];

  // Leg 1/2
  leg1DialStatusName?: string;

  // Transfer
  OriginalIvrUniqueID?: string;

  // Campaign / Dialer
  campaignName?: string;
  campaignCode?: string;
  campaignID?: number;
  CampaignTypeID?: number;
  campaignTypeName?: string;
  CallID?: string;
  StatusName?: string;
  Phone?: string;
  CallInserted?: string;
  RetryNum?: number;
  RetryAmount?: number;
  dialerData?: VoicenterDialerData;

  // Do Not Call Me
  DoNotCallMeStatus?: string;
  DoNotCallMeStatusCode?: string;
  DoNotCallMetransactionId?: string;
  IsDoNotCallMe?: string;

  // AI Data
  aiData?: VoicenterAIData | null;

  // Gemini Analysis (added on-demand)
  geminiAnalysis?: GeminiAnalysis;

  // F7: Starred/favorite
  starred?: boolean;

  // Allow additional fields
  [key: string]: any;
}

// --- Gemini Analysis Result ---

export interface GeminiAnalysis {
  summary: string;
  tags: { id: string; label: string; detected: boolean }[];
  keyPoints: { label: string; quote: string }[];
  email: string;
  crmNote: string;
  callType: string;
  analyzedAt: string; // ISO timestamp
  objectionType?: string; // F4: price | timing | competitor | not_relevant | needs_approval | none
}

// --- Call List Item (lightweight for index/list views) ---

export interface CallListItem {
  ivruniqueid: string;
  time: number;
  caller: string;
  target: string;
  direction: string;
  type: string;
  status: string;
  duration: number;
  did: string;
  representative_name: string;
  queuename: string;
  hasAI: boolean;
  hasSummary: boolean;
  hasAnalysis: boolean;
  // New fields
  starred: boolean;           // F7
  detectedTags: string[];     // F2: tag IDs detected as true
  objectionType?: string;     // F4
  summary?: string;           // F8: for AI search
  crmNote?: string;           // F8: for AI search
}

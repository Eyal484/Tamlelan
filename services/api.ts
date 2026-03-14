import type { VoicenterCall, CallListItem, GeminiAnalysis } from '../types';

const API_BASE = '/api';

// ── Auth token (set by App.tsx on login / token refresh) ─────
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

function getAuthHeaders(): Record<string, string> {
  return _authToken ? { Authorization: `Bearer ${_authToken}` } : {};
}

// ── Types ─────────────────────────────────────────────────────
export interface CallsListResponse {
  calls: CallListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Calls ─────────────────────────────────────────────────────
export async function fetchCalls(params?: {
  page?: number;
  limit?: number;
  search?: string;
  direction?: string;
  starred?: boolean;
  tags?: string[];
}): Promise<CallsListResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.search) qs.set('search', params.search);
  if (params?.direction && params.direction !== 'all') qs.set('direction', params.direction);
  if (params?.starred) qs.set('starred', 'true');
  if (params?.tags?.length) qs.set('tags', params.tags.join(','));

  const res = await fetch(`${API_BASE}/calls?${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch calls');
  return res.json();
}

export async function fetchCall(id: string): Promise<VoicenterCall> {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Call not found');
  return res.json();
}

export async function deleteCall(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete call');
}

export async function analyzeCall(id: string, callType: string, customContext?: string): Promise<GeminiAnalysis> {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(id)}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ callType, customContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
    throw new Error(err.error || 'Analysis failed');
  }
  return res.json();
}

// F7: Star/unstar a call
export async function starCall(id: string, starred: boolean): Promise<CallListItem> {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(id)}/star`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ starred }),
  });
  if (!res.ok) throw new Error('Failed to star call');
  return res.json();
}

// F6: Full-text search in transcripts
export async function searchTranscripts(q: string): Promise<{ calls: CallListItem[] }> {
  const res = await fetch(`${API_BASE}/search/transcripts?q=${encodeURIComponent(q)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

// F8: AI semantic search
export interface AiCallResult extends CallListItem {
  aiHighlight?: string; // short phrase explaining why Gemini matched this call
}

export async function aiSearch(query: string): Promise<{ calls: AiCallResult[] }> {
  const res = await fetch(`${API_BASE}/search/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('AI search failed');
  return res.json();
}

// F9: Ask Gemini about a specific call
export async function askCall(id: string, question: string): Promise<{ answer: string }> {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(id)}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to answer' }));
    throw new Error(err.error || 'Failed to answer');
  }
  return res.json();
}

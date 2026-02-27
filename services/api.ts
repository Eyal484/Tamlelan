import type { VoicenterCall, CallListItem, GeminiAnalysis } from '../types';

const API_BASE = '/api';

export interface CallsListResponse {
  calls: CallListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchCalls(params?: {
  page?: number;
  limit?: number;
  search?: string;
  direction?: string;
}): Promise<CallsListResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.search) qs.set('search', params.search);
  if (params?.direction && params.direction !== 'all') qs.set('direction', params.direction);

  const res = await fetch(`${API_BASE}/calls?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch calls');
  return res.json();
}

export async function fetchCall(id: string): Promise<VoicenterCall> {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Call not found');
  return res.json();
}

export async function deleteCall(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete call');
}

export async function analyzeCall(id: string, callType: string, customContext?: string): Promise<GeminiAnalysis> {
  const res = await fetch(`${API_BASE}/calls/${encodeURIComponent(id)}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callType, customContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
    throw new Error(err.error || 'Analysis failed');
  }
  return res.json();
}

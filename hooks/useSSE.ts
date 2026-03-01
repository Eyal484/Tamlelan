import { useEffect, useRef } from 'react';
import type { CallListItem } from '../types';

export function useSSE(
  token: string,
  callbacks: {
    onNewCall?: (call: CallListItem) => void;
    onDeleteCall?: (data: { ivruniqueid: string }) => void;
    onUpdateCall?: (data: { ivruniqueid: string; hasAnalysis?: boolean }) => void;
  },
) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!token) return; // wait until we have a token

    const evtSource = new EventSource(`/api/calls/stream?token=${encodeURIComponent(token)}`);

    evtSource.addEventListener('new-call', (e) => {
      try {
        const call = JSON.parse(e.data) as CallListItem;
        callbacksRef.current.onNewCall?.(call);
      } catch (err) {
        console.error('[SSE] Error parsing new-call event:', err);
      }
    });

    evtSource.addEventListener('delete-call', (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacksRef.current.onDeleteCall?.(data);
      } catch (err) {
        console.error('[SSE] Error parsing delete-call event:', err);
      }
    });

    evtSource.addEventListener('update-call', (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacksRef.current.onUpdateCall?.(data);
      } catch (err) {
        console.error('[SSE] Error parsing update-call event:', err);
      }
    });

    evtSource.onerror = () => {
      console.warn('[SSE] Connection error, will auto-reconnect...');
    };

    return () => {
      evtSource.close();
    };
  }, [token]); // re-connect when token changes (e.g. hourly refresh)
}

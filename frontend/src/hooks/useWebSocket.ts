import { useEffect, useRef, useCallback, useState } from 'react';
import { WS_BASE } from '../api/client';

export function useWebSocket<T>(path: string, onMessage: (data: T) => void, enabled = true) {
  const wsRef      = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const attemptRef = useRef(0);                      // tracks reconnect attempts
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!enabled) return;
    try {
      const ws = new WebSocket(`${WS_BASE}${path}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        attemptRef.current = 0;                      // reset backoff on success
      };

      ws.onmessage = (e: MessageEvent<string>) => {
        try {
          const data = JSON.parse(e.data) as T & { type?: string };
          if ((data as { type?: string }).type !== 'ping') onMessageRef.current(data);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
        // Exponential backoff: 5s, 10s, 20s, 40s, capped at 60s
        const delay = Math.min(5_000 * 2 ** attemptRef.current, 60_000);
        attemptRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    } catch {
      const delay = Math.min(5_000 * 2 ** attemptRef.current, 60_000);
      attemptRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    }
  }, [path, enabled]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}

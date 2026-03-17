import { useEffect, useRef, useCallback, useState } from 'react';
import { WS_BASE } from '../api/client';

export function useWebSocket<T>(path: string, onMessage: (data: T) => void, enabled = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!enabled) return;
    try {
      const ws = new WebSocket(`${WS_BASE}${path}`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (e: MessageEvent<string>) => {
        try {
          const data = JSON.parse(e.data) as T & { type?: string };
          if ((data as { type?: string }).type !== 'ping') onMessageRef.current(data);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
        timerRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    } catch {
      timerRef.current = setTimeout(connect, 10_000);
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

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface SocketEvent {
  type: string;
  market_id: string;
  data: Record<string, unknown>;
}

/**
 * Subscribes to server events. Messages are treated as "something changed" signals:
 * we invalidate cached queries and let REST refetch the source of truth.
 */
export function useMarketSocket(marketId = "*", onEvent?: (e: SocketEvent) => void) {
  const qc = useQueryClient();
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let pending: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws?market_id=${encodeURIComponent(marketId)}`);
      ws.onmessage = (msg) => {
        const event = JSON.parse(msg.data) as SocketEvent;
        onEvent?.(event);
        clearTimeout(pending);
        pending = setTimeout(() => qc.invalidateQueries(), 60);
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 1500);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearTimeout(pending);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, qc]);
}

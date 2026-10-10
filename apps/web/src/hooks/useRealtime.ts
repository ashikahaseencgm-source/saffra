import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

// Same-origin by default (see api/client.ts) — window.location.origin is
// whatever host/IP the page was actually loaded from, so this works
// unmodified from any device on the LAN, not just the host machine.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;
const CONNECT_TIMEOUT_MS = 3000;
const POLL_INTERVAL_MS = 5000;

const REALTIME_EVENTS = [
  "table.updated",
  "order.created",
  "order.updated",
  "order.confirmed",
  "kitchen.updated",
  "payment.completed",
  "payment.failed",
  "receipt.generated",
  "guest.request.created",
  "guest.request.updated",
] as const;

/** Fired on window when a guest orders from a table QR code (for the alert chime/toast). */
export const GUEST_REQUEST_EVENT = "saffra:guest-request";

/**
 * Subscribes to Saffra's realtime events and invalidates the relevant React
 * Query caches so Tables/Kitchen/Orders update instantly across screens. If
 * the socket can't connect within CONNECT_TIMEOUT_MS (dev server without
 * websockets, restrictive network, etc.) it falls back to polling the same
 * query keys on an interval — a real fallback, not just a comment, so the
 * UI never silently goes stale.
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["kitchen"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["guest-requests"] });
    };

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = window.setInterval(invalidateAll, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const socket = io(SOCKET_URL, { path: "/socket.io", transports: ["websocket", "polling"], reconnectionAttempts: 5 });
    socketRef.current = socket;

    const connectTimer = window.setTimeout(() => {
      if (!socket.connected) startPolling();
    }, CONNECT_TIMEOUT_MS);

    socket.on("connect", () => {
      window.clearTimeout(connectTimer);
      stopPolling();
    });

    socket.on("disconnect", () => startPolling());
    socket.on("connect_error", () => startPolling());

    REALTIME_EVENTS.forEach((event) => socket.on(event, invalidateAll));
    socket.on("guest.request.created", (payload: unknown) => {
      window.dispatchEvent(new CustomEvent(GUEST_REQUEST_EVENT, { detail: payload }));
    });

    return () => {
      window.clearTimeout(connectTimer);
      stopPolling();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient]);
}

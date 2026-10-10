import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

// Realtime event names — shared contract with the frontend's useRealtime hook.
export const REALTIME_EVENTS = {
  TABLE_UPDATED: "table.updated",
  ORDER_CREATED: "order.created",
  ORDER_UPDATED: "order.updated",
  ORDER_CONFIRMED: "order.confirmed",
  KITCHEN_UPDATED: "kitchen.updated",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",
  RECEIPT_GENERATED: "receipt.generated",
  GUEST_REQUEST_CREATED: "guest.request.created",
  GUEST_REQUEST_UPDATED: "guest.request.updated",
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

// One Socket.IO server per listening port (the main port, plus port 80 when
// the friendly no-port address is active). Events go out on all of them.
const servers: SocketIOServer[] = [];

export function initSocketGateway(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    logger.info(`socket connected: ${socket.id}`);
    socket.join("restaurant:default");
    socket.on("disconnect", () => logger.info(`socket disconnected: ${socket.id}`));
  });

  servers.push(io);
  return io;
}

/**
 * Emits a realtime event to all connected clients. Safe no-op if the socket
 * server hasn't been initialized (e.g. during tests) — callers never need to
 * branch on whether realtime is available.
 */
export function emitRealtime(event: RealtimeEvent, payload: unknown): void {
  for (const io of servers) io.to("restaurant:default").emit(event, payload);
}

export function getSocketServer(): SocketIOServer | null {
  return servers[0] ?? null;
}

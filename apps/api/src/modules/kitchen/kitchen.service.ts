import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { emitRealtime, REALTIME_EVENTS } from "../../lib/socket.js";
import { recordAudit } from "../audit/auditService.js";
import { syncOrderWithKitchen } from "../orders/orders.service.js";
import type { KitchenTicketStatus } from "@saffra/types";

const TICKET_INCLUDE = {
  order: {
    include: {
      items: true,
      table: true,
      waiter: { select: { name: true } },
      customer: { select: { name: true } },
    },
  },
} as const;

function toKitchenTicketDTO(ticket: Awaited<ReturnType<typeof fetchTicket>>) {
  const order = ticket.order;
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    // Round 1 is the table's first order; 2+ are "more items" for a table
    // the kitchen has already cooked for.
    round: ticket.round,
    status: ticket.status,
    orderId: order.id,
    orderNumber: order.orderNumber,
    tableNumber: order.table?.number ?? null,
    waiterName: order.waiter.name,
    customerName: order.customer?.name ?? order.customerName ?? null,
    // Exactly the lines sent in THIS round — never PENDING lines that
    // haven't been sent, and never another round's food.
    items: order.items
      .filter((i) => i.kitchenTicketId === ticket.id)
      .map((i) => ({ name: i.nameSnapshot, quantity: i.quantity, notes: i.notes })),
    note: order.note,
    createdAt: ticket.createdAt.toISOString(),
    elapsedMinutes: Math.max(0, Math.round((Date.now() - ticket.createdAt.getTime()) / 60000)),
  };
}

async function fetchTicket(id: string) {
  const ticket = await prisma.kitchenTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
  if (!ticket) throw AppError.notFound("Kitchen ticket not found");
  return ticket;
}

export async function listActiveTickets(restaurantId: string) {
  const tickets = await prisma.kitchenTicket.findMany({
    where: { status: { not: "COMPLETED" }, order: { restaurantId } },
    include: TICKET_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return tickets.map(toKitchenTicketDTO);
}


const TICKET_TRANSITIONS: Record<KitchenTicketStatus, KitchenTicketStatus | null> = {
  NEW: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
  COMPLETED: null,
};

export async function advanceTicket(ticketId: string, actorId: string) {
  const ticket = await fetchTicket(ticketId);
  const next = TICKET_TRANSITIONS[ticket.status as KitchenTicketStatus];
  if (!next) throw AppError.conflict(`Ticket is already ${ticket.status}`);

  const timestampField =
    next === "ACCEPTED" ? "acceptedAt" : next === "READY" ? "readyAt" : next === "COMPLETED" ? "completedAt" : undefined;

  await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data: { status: next, ...(timestampField ? { [timestampField]: new Date() } : {}) },
  });

  await syncOrderWithKitchen(ticket.orderId);

  await recordAudit({
    userId: actorId,
    orderId: ticket.orderId,
    action: `KITCHEN_TICKET_${next}`,
    entity: "KitchenTicket",
    entityId: ticketId,
  });
  emitRealtime(REALTIME_EVENTS.KITCHEN_UPDATED, { ticketId, status: next });

  return toKitchenTicketDTO(await fetchTicket(ticketId));
}

const TICKET_RECALL: Record<KitchenTicketStatus, KitchenTicketStatus | null> = {
  NEW: null,
  ACCEPTED: "NEW",
  PREPARING: "ACCEPTED",
  READY: "PREPARING",
  COMPLETED: null, // completed tickets are done — no undo from here
};

/**
 * Undo the last kitchen action on a ticket (e.g. an accidental tap). The
 * order/table status is then re-derived from all of the order's rounds.
 */
export async function recallTicket(ticketId: string, actorId: string) {
  const ticket = await fetchTicket(ticketId);
  const previous = TICKET_RECALL[ticket.status as KitchenTicketStatus];
  if (!previous) throw AppError.conflict(`Ticket in status ${ticket.status} can't be recalled`);

  await prisma.kitchenTicket.update({ where: { id: ticketId }, data: { status: previous } });

  await syncOrderWithKitchen(ticket.orderId);

  await recordAudit({
    userId: actorId,
    orderId: ticket.orderId,
    action: `KITCHEN_TICKET_RECALLED_TO_${previous}`,
    entity: "KitchenTicket",
    entityId: ticketId,
  });
  emitRealtime(REALTIME_EVENTS.KITCHEN_UPDATED, { ticketId, status: previous });

  return toKitchenTicketDTO(await fetchTicket(ticketId));
}

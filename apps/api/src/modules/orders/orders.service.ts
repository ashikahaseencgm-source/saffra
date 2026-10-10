import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { computeBill } from "../billing/billingEngine.js";
import { getTaxConfig, getOrCreateRestaurant } from "../settings/settings.service.js";
import { generateOrderNumber, generateTicketNumber, generatePayLinkToken } from "../../utils/ids.js";
import { recordAudit } from "../audit/auditService.js";
import { emitRealtime, REALTIME_EVENTS } from "../../lib/socket.js";
import type { OrderDTO, OrderItemKitchenStatus, OrderStatus, OrderType } from "@saffra/types";
import type { Prisma } from "@prisma/client";

const ORDER_INCLUDE = {
  items: { orderBy: { createdAt: "asc" as const } },
  table: true,
  waiter: { select: { id: true, name: true } },
  customer: { select: { phone: true, name: true } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

function toOrderDTO(order: OrderWithRelations): OrderDTO {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tableId: order.tableId,
    tableNumber: order.table?.number ?? null,
    orderType: order.orderType as OrderType,
    status: order.status as OrderStatus,
    waiterId: order.waiterId,
    waiterName: order.waiter.name,
    customerId: order.customerId,
    customerName: order.customer?.name ?? order.customerName ?? null,
    customerPhone: order.customer?.phone ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.nameSnapshot,
      price: Number(item.priceSnapshot),
      quantity: item.quantity,
      notes: item.notes,
      total: Number(item.priceSnapshot) * item.quantity,
      kitchenStatus: item.kitchenStatus as OrderItemKitchenStatus,
    })),
    note: order.note,
    bill: {
      subtotal: Number(order.subtotal),
      cgst: Number(order.cgst),
      sgst: Number(order.sgst),
      gstTotal: Number(order.cgst) + Number(order.sgst),
      serviceCharge: Number(order.serviceCharge),
      discountAmount: Number(order.discountAmount),
      discountReason: order.discountReason,
      loyaltyDiscount: Number(order.loyaltyDiscount),
      loyaltyPointsRedeemed: order.loyaltyPointsRedeemed,
      roundOff: Number(order.roundOff),
      grandTotal: Number(order.grandTotal),
    },
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

// Strict lifecycle — every transition not listed here is rejected.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SENT_TO_KITCHEN", "CANCELLED"],
  SENT_TO_KITCHEN: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "SERVED", "CANCELLED"],
  PAID: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertTransition(current: OrderStatus, next: OrderStatus) {
  if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
    throw AppError.conflict(`Cannot move order from ${current} to ${next}`);
  }
}

// Items can be added/changed any time up through SERVED — customers
// regularly order more (drinks, dessert, a second round) after their first
// course is out. Once a payment has actually been initiated the menu locks,
// so billing and the cart can't shift out from under a checkout in progress.
const ITEM_EDITABLE_STATUSES: OrderStatus[] = ["DRAFT", "CONFIRMED", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED"];

const SENT_ITEM_LOCKED_MESSAGE =
  "This item has already gone to the kitchen, so it can't be changed or removed. To add more, add it again — it will go to the kitchen as a new order on the same bill.";

// Any status from CONFIRMED onward has real items and a real bill, so a
// cashier can bill the table on request even if the kitchen hasn't (yet)
// marked everything served — right up until it's actually been paid.
export const PAYABLE_ORDER_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "SENT_TO_KITCHEN",
  "PREPARING",
  "READY",
  "SERVED",
  "PAYMENT_PENDING",
];

async function fetchOrderOrThrow(id: string): Promise<OrderWithRelations> {
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  if (!order) throw AppError.notFound("Order not found");
  return order;
}

/** Recomputes and persists the bill from current items + tax config + any active discount. */
export async function recalculateOrderBill(orderId: string): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, restaurant: true, discounts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const taxConfig = await getTaxConfig(order.restaurantId);
  const activeDiscount = order.discounts[0];

  const items = order.items.map((i) => ({ price: Number(i.priceSnapshot), quantity: i.quantity }));
  const discount = activeDiscount ? { type: activeDiscount.type as any, value: Number(activeDiscount.value) } : null;
  const storedPoints = order.loyaltyPointsRedeemed ?? 0;
  const perPoint = storedPoints > 0 ? Number(order.loyaltyDiscount) / storedPoints : 0;

  let points = storedPoints;
  let bill = computeBill(items, taxConfig, discount, points * perPoint);
  if (points > 0 && bill.loyaltyDiscount + 1e-9 < points * perPoint) {
    // The bill shrank (items removed / bigger discount) below the points
    // applied. Spend only the whole points that still fit, never more.
    points = Math.floor(bill.loyaltyDiscount / perPoint + 1e-9);
    bill = computeBill(items, taxConfig, discount, points * perPoint);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      subtotal: bill.subtotal,
      cgst: bill.cgst,
      sgst: bill.sgst,
      serviceCharge: bill.serviceCharge,
      discountAmount: bill.discountAmount,
      loyaltyDiscount: bill.loyaltyDiscount,
      loyaltyPointsRedeemed: points,
      discountReason: activeDiscount?.reason ?? null,
      roundOff: bill.roundOff,
      grandTotal: bill.grandTotal,
    },
  });
}

export async function listOrders(restaurantId: string, filters: {
  status?: string;
  waiterId?: string;
  tableId?: string;
  from?: string;
  to?: string;
  billable?: boolean;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.OrderWhereInput = { restaurantId };
  if (filters.billable) where.status = { in: PAYABLE_ORDER_STATUSES as any };
  else if (filters.status) where.status = filters.status as any;
  if (filters.waiterId) where.waiterId = filters.waiterId;
  if (filters.tableId) where.tableId = filters.tableId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return {
    data: orders.map(toOrderDTO),
    pagination: { total, page: filters.page, pageSize: filters.pageSize, totalPages: Math.ceil(total / filters.pageSize) || 1 },
  };
}

export async function getOrder(id: string): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(id);
  return toOrderDTO(order);
}

export async function createOrder(
  restaurantId: string,
  waiterId: string,
  input: { tableId?: string | null; orderType: OrderType; customerName?: string | null; customerId?: string | null },
): Promise<OrderDTO> {
  if (input.orderType === "DINE_IN" && !input.tableId) {
    throw AppError.badRequest("Dine-in orders require a table");
  }

  if (input.tableId) {
    const table = await prisma.restaurantTable.findUnique({ where: { id: input.tableId } });
    if (!table) throw AppError.notFound("Table not found");
    if (!["AVAILABLE", "RESERVED"].includes(table.status)) {
      // A table visit is ONE running bill. If it still has any non-final
      // order (including PAYMENT_PENDING/PAID — not yet cleared), that
      // order is what more items get added to; see
      // payments.service.cancelPendingPaymentForReorder for the
      // PAYMENT_PENDING case, and orders.service.reopenKitchenIfNeeded for
      // adding items after READY/SERVED. We never fork a second bill for
      // the same visit.
      const existingActive = await prisma.order.findFirst({
        where: { tableId: input.tableId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      });
      if (existingActive) throw AppError.conflict("Table already has an active order", { orderId: existingActive.id });
    }
  }

  const restaurant = await getOrCreateRestaurant();
  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(restaurant.invoicePrefix),
      orderType: input.orderType,
      tableId: input.tableId ?? null,
      waiterId,
      restaurantId,
      customerName: input.customerName ?? null,
      customerId: input.customerId ?? null,
    },
    include: ORDER_INCLUDE,
  });

  if (input.tableId) {
    await prisma.restaurantTable.update({ where: { id: input.tableId }, data: { status: "ORDERING" } });
    emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: input.tableId, status: "ORDERING" });
  }

  if (input.customerId) {
    await prisma.customer.update({ where: { id: input.customerId }, data: { visitCount: { increment: 1 } } });
  }

  await recordAudit({ userId: waiterId, orderId: order.id, action: "ORDER_CREATED", entity: "Order", entityId: order.id });
  emitRealtime(REALTIME_EVENTS.ORDER_CREATED, { orderId: order.id });

  return toOrderDTO(order);
}

export async function updateOrder(id: string, data: { note?: string | null; customerName?: string | null; orderType?: OrderType }) {
  await prisma.order.update({ where: { id }, data });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId: id });
  return getOrder(id);
}

export async function addOrderItem(
  orderId: string,
  input: { menuItemId: string; quantity: number; notes?: string | null },
  actorId: string,
): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(orderId);
  if (!ITEM_EDITABLE_STATUSES.includes(order.status as OrderStatus)) {
    throw AppError.conflict("Items can no longer be changed once the order has been billed");
  }

  const menuItem = await prisma.menuItem.findUnique({ where: { id: input.menuItemId } });
  if (!menuItem || menuItem.deletedAt) throw AppError.notFound("Menu item not found");
  if (!menuItem.available) throw AppError.conflict(`${menuItem.name} is currently unavailable`);

  // Only merge into an existing line while it's still un-sent (PENDING) —
  // merging onto a FIRED or SERVED line would silently sneak extra quantity
  // into the kitchen without ever going through the explicit "Send to
  // Kitchen" action. Anything else (brand new, or a repeat of a line
  // that's already out) becomes its own fresh PENDING line.
  const existing = order.items.find(
    (i) => i.menuItemId === input.menuItemId && (i.notes ?? "") === (input.notes ?? "") && i.kitchenStatus === "PENDING",
  );
  if (existing) {
    await prisma.orderItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + input.quantity } });
  } else {
    await prisma.orderItem.create({
      data: {
        orderId,
        menuItemId: input.menuItemId,
        nameSnapshot: menuItem.name,
        priceSnapshot: menuItem.price,
        quantity: input.quantity,
        notes: input.notes ?? null,
        kitchenStatus: "PENDING",
      },
    });
  }

  await recalculateOrderBill(orderId);
  await recordAudit({ userId: actorId, orderId, action: "ITEM_ADDED", entity: "OrderItem", metadata: { menuItemId: input.menuItemId, quantity: input.quantity } });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
  return getOrder(orderId);
}

export async function updateOrderItem(
  orderId: string,
  itemId: string,
  data: { quantity?: number; notes?: string | null },
  actorId: string,
): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(orderId);
  if (!ITEM_EDITABLE_STATUSES.includes(order.status as OrderStatus)) {
    throw AppError.conflict("Items can no longer be changed once the order has been billed");
  }
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw AppError.notFound("Order item not found");

  const increasingQuantity = data.quantity !== undefined && data.quantity > item.quantity;

  if (item.kitchenStatus !== "PENDING") {
    // Once a line has gone to the kitchen it's locked — the kitchen may
    // already be cooking it, so it can't be reduced, re-noted or removed.
    // Asking for MORE is still fine: only the extra quantity is new, so it
    // becomes its own PENDING line that goes out as the next kitchen round.
    if (!increasingQuantity) throw AppError.conflict(SENT_ITEM_LOCKED_MESSAGE);
    const extra = data.quantity! - item.quantity;
    await prisma.orderItem.create({
      data: {
        orderId,
        menuItemId: item.menuItemId,
        nameSnapshot: item.nameSnapshot,
        priceSnapshot: item.priceSnapshot,
        quantity: extra,
        notes: data.notes !== undefined ? data.notes : item.notes,
        kitchenStatus: "PENDING",
      },
    });
  } else {
    await prisma.orderItem.update({ where: { id: itemId }, data });
  }

  await recalculateOrderBill(orderId);
  await recordAudit({ userId: actorId, orderId, action: "ITEM_QUANTITY_CHANGED", entity: "OrderItem", entityId: itemId, metadata: data });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
  return getOrder(orderId);
}

export async function removeOrderItem(orderId: string, itemId: string, actorId: string): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(orderId);
  if (!ITEM_EDITABLE_STATUSES.includes(order.status as OrderStatus)) {
    throw AppError.conflict("Items can no longer be changed once the order has been billed");
  }
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw AppError.notFound("Order item not found");
  if (item.kitchenStatus !== "PENDING") throw AppError.conflict(SENT_ITEM_LOCKED_MESSAGE);
  await prisma.orderItem.delete({ where: { id: itemId } });
  await recalculateOrderBill(orderId);
  await recordAudit({ userId: actorId, orderId, action: "ITEM_REMOVED", entity: "OrderItem", entityId: itemId });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
  return getOrder(orderId);
}

export async function applyDiscount(
  orderId: string,
  input: { type: "PERCENTAGE" | "FLAT"; value: number; reason: string },
  approverId: string,
): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(orderId);
  if (["PAID", "COMPLETED", "CANCELLED"].includes(order.status)) {
    throw AppError.conflict("Cannot apply a discount to a finalized order");
  }
  await prisma.discount.create({
    data: { orderId, type: input.type, value: input.value, reason: input.reason, approvedById: approverId },
  });
  await recalculateOrderBill(orderId);
  await recordAudit({ userId: approverId, orderId, action: "DISCOUNT_APPLIED", entity: "Discount", metadata: input });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
  return getOrder(orderId);
}

export async function confirmOrder(orderId: string, actorId: string): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(orderId);
  if (order.items.length === 0) throw AppError.badRequest("Cannot confirm an order with no items");
  assertTransition(order.status as OrderStatus, "CONFIRMED");

  await prisma.order.update({ where: { id: orderId }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  if (order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "ORDERING" } });
  }
  await recordAudit({ userId: actorId, orderId, action: "ORDER_CONFIRMED", entity: "Order", entityId: orderId });
  emitRealtime(REALTIME_EVENTS.ORDER_CONFIRMED, { orderId });
  return getOrder(orderId);
}

/**
 * The only way items ever reach the kitchen — nothing gets fired
 * automatically just from being added to the cart. Every send is its own
 * kitchen round: a brand-new ticket holding exactly the PENDING lines. A
 * ticket that's already been sent is never edited or reopened, so the
 * kitchen never sees food it's cooking change underneath it; "more food"
 * is simply the next round, and it all stays on the same order and bill.
 */
export async function sendToKitchen(orderId: string, actorId: string): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(orderId);
  if (!ITEM_EDITABLE_STATUSES.includes(order.status as OrderStatus)) {
    throw AppError.conflict("This order has already been billed, so nothing more can go to the kitchen");
  }
  const pendingItems = order.items.filter((i) => i.kitchenStatus === "PENDING");
  if (pendingItems.length === 0) {
    throw AppError.conflict("There's nothing new to send to the kitchen");
  }

  const previousRounds = await prisma.kitchenTicket.count({ where: { orderId } });
  const isFirstRound = previousRounds === 0;
  if (isFirstRound) assertTransition(order.status as OrderStatus, "SENT_TO_KITCHEN");

  const ticketId = crypto.randomUUID();
  const round = previousRounds + 1;
  await prisma.$transaction([
    prisma.kitchenTicket.create({ data: { id: ticketId, orderId, round, ticketNumber: generateTicketNumber() } }),
    prisma.orderItem.updateMany({
      where: { id: { in: pendingItems.map((i) => i.id) }, kitchenStatus: "PENDING" },
      data: { kitchenStatus: "FIRED", kitchenTicketId: ticketId },
    }),
  ]);

  if (isFirstRound) {
    await prisma.order.update({ where: { id: orderId }, data: { status: "SENT_TO_KITCHEN" } });
    if (order.tableId) {
      await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "FOOD_PREPARING" } });
      emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: order.tableId, status: "FOOD_PREPARING" });
    }
  } else {
    await syncOrderWithKitchen(orderId);
  }

  await recordAudit({
    userId: actorId,
    orderId,
    action: isFirstRound ? "SENT_TO_KITCHEN" : "MORE_ITEMS_SENT_TO_KITCHEN",
    entity: "KitchenTicket",
    entityId: ticketId,
    metadata: { round, itemCount: pendingItems.length },
  });

  emitRealtime(REALTIME_EVENTS.KITCHEN_UPDATED, { orderId, ticketId });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
  return getOrder(orderId);
}

// While food is still with the kitchen, the order's status follows its
// least-advanced open round: one dish still waiting means the table is still
// waiting, even if an earlier round is already plated.
const KITCHEN_PHASE_STATUSES: OrderStatus[] = ["SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED"];
const TICKET_STAGE: Record<string, number> = { NEW: 0, ACCEPTED: 0, PREPARING: 1, READY: 2 };
const STAGE_ORDER_STATUS: OrderStatus[] = ["SENT_TO_KITCHEN", "PREPARING", "READY"];

/**
 * Re-derives order + table status from the order's open kitchen rounds.
 * Called after any ticket changes. Deliberately a no-op outside the kitchen
 * phase (e.g. once billing has started) so the kitchen can finish cooking an
 * order the cashier is already charging for without tripping the order
 * state machine.
 */
export async function syncOrderWithKitchen(orderId: string): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!KITCHEN_PHASE_STATUSES.includes(order.status as OrderStatus)) return;

  const openTickets = await prisma.kitchenTicket.findMany({ where: { orderId, status: { not: "COMPLETED" } } });
  if (openTickets.length === 0) return;

  const stage = Math.min(...openTickets.map((t) => TICKET_STAGE[t.status] ?? 0));
  const next = STAGE_ORDER_STATUS[stage]!;
  if (next === order.status) return;

  await prisma.order.update({ where: { id: orderId }, data: { status: next } });
  if (order.tableId) {
    const tableStatus = next === "READY" ? "READY_TO_SERVE" : "FOOD_PREPARING";
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: tableStatus } });
    emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: order.tableId, status: tableStatus });
  }
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
}

export async function markServed(orderId: string, actorId: string): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(orderId);
  assertTransition(order.status as OrderStatus, "SERVED");
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: "SERVED" } }),
    // Everything currently fired is what's actually being delivered right
    // now — flipping it to SERVED is what keeps a later repeat order from
    // merging into (and re-firing) this same line.
    prisma.orderItem.updateMany({ where: { orderId, kitchenStatus: "FIRED" }, data: { kitchenStatus: "SERVED" } }),
    // The food has left the pass, so its rounds come off the kitchen board.
    prisma.kitchenTicket.updateMany({ where: { orderId, status: "READY" }, data: { status: "COMPLETED", completedAt: new Date() } }),
  ]);
  if (order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "READY_TO_SERVE" } });
  }
  await recordAudit({ userId: actorId, orderId, action: "ORDER_SERVED", entity: "Order", entityId: orderId });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
  emitRealtime(REALTIME_EVENTS.KITCHEN_UPDATED, { orderId });
  return getOrder(orderId);
}

export async function completeOrder(orderId: string, actorId: string): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(orderId);
  assertTransition(order.status as OrderStatus, "COMPLETED");
  await prisma.order.update({ where: { id: orderId }, data: { status: "COMPLETED", completedAt: new Date() } });
  if (order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "AVAILABLE" } });
    emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: order.tableId, status: "AVAILABLE" });
  }
  await recordAudit({ userId: actorId, orderId, action: "ORDER_COMPLETED", entity: "Order", entityId: orderId });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
  return getOrder(orderId);
}

export async function cancelOrder(orderId: string, actorId: string, reason?: string): Promise<OrderDTO> {
  const order = await fetchOrderOrThrow(orderId);
  assertTransition(order.status as OrderStatus, "CANCELLED");
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
    // Take every unfinished round off the kitchen board so nobody keeps cooking it.
    prisma.kitchenTicket.updateMany({
      where: { orderId, status: { not: "COMPLETED" } },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
  ]);
  if (order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "AVAILABLE" } });
    emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: order.tableId, status: "AVAILABLE" });
  }
  await recordAudit({ userId: actorId, orderId, action: "ORDER_CANCELLED", entity: "Order", entityId: orderId, metadata: { reason } });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
  emitRealtime(REALTIME_EVENTS.KITCHEN_UPDATED, { orderId });
  return getOrder(orderId);
}

/**
 * Generates (or returns the existing) public, unauthenticated pay-link token
 * for an order, so staff can share a URL the customer opens on their own
 * phone to pay directly — see modules/publicPay for the token-scoped routes.
 */
export async function getOrCreatePaymentLinkToken(orderId: string, actorId: string): Promise<string> {
  const order = await fetchOrderOrThrow(orderId);
  if (!PAYABLE_ORDER_STATUSES.includes(order.status as OrderStatus)) {
    throw AppError.conflict(`Order in status ${order.status} is not ready for a payment link`);
  }
  if (order.publicPayToken) return order.publicPayToken;

  const token = generatePayLinkToken();
  await prisma.order.update({ where: { id: orderId }, data: { publicPayToken: token } });
  await recordAudit({ userId: actorId, orderId, action: "PAYMENT_LINK_GENERATED", entity: "Order", entityId: orderId });
  return token;
}

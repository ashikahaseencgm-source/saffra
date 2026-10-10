import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { emitRealtime, REALTIME_EVENTS } from "../../lib/socket.js";
import { recordAudit } from "../audit/auditService.js";
import { normalizePhone } from "../customers/customers.service.js";
import { addOrderItem, confirmOrder, createOrder, sendToKitchen } from "../orders/orders.service.js";
import { getLoyaltyConfig } from "../loyalty/loyalty.service.js";
import type { GuestRequestInput } from "./guestOrdering.schema.js";

/**
 * Guest self-ordering from a table's QR code.
 *
 * The QR code holds an unguessable per-table token (not the table id), so
 * nobody can order "for table 7" without having been at table 7. A guest's
 * order is only a REQUEST: it reaches the kitchen when a staff member
 * accepts it, at which point it's added to that table's one running bill
 * through the normal order/kitchen flow.
 */

const MAX_PENDING_PER_TABLE = 3;
const ACTIVE_ORDER_FILTER = { status: { notIn: ["COMPLETED", "CANCELLED"] } };

interface RequestItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
}

const newToken = () => crypto.randomBytes(12).toString("base64url");

// ─── Table QR codes (staff) ────────────────────────────────────────────────

export async function listTableQrCodes(restaurantId: string) {
  const tables = await prisma.restaurantTable.findMany({ where: { restaurantId, deletedAt: null }, orderBy: { number: "asc" } });
  for (const t of tables) {
    if (!t.qrToken) {
      t.qrToken = newToken();
      await prisma.restaurantTable.update({ where: { id: t.id }, data: { qrToken: t.qrToken } });
    }
  }
  return tables.map((t) => ({ tableId: t.id, number: t.number, capacity: t.capacity, qrToken: t.qrToken! }));
}

/** New code for one table — old printed codes for it stop working immediately. */
export async function regenerateTableQr(tableId: string, actorId: string) {
  const table = await prisma.restaurantTable.findUnique({ where: { id: tableId } });
  if (!table || table.deletedAt) throw AppError.notFound("Table not found");
  const qrToken = newToken();
  await prisma.restaurantTable.update({ where: { id: tableId }, data: { qrToken } });
  await recordAudit({ userId: actorId, action: "TABLE_QR_REGENERATED", entity: "RestaurantTable", entityId: tableId });
  return { tableId, number: table.number, capacity: table.capacity, qrToken };
}

// ─── Guest side (public, token-scoped) ─────────────────────────────────────

async function resolveTable(token: string) {
  const table = await prisma.restaurantTable.findUnique({ where: { qrToken: token } });
  if (!table || table.deletedAt) throw AppError.notFound("This table code isn't valid any more. Please ask a staff member.");
  return table;
}

export async function getGuestMenu(token: string) {
  const table = await resolveTable(token);
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { id: table.restaurantId } });
  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: table.restaurantId },
    orderBy: { sortOrder: "asc" },
    include: { items: { where: { deletedAt: null }, orderBy: { name: "asc" } } },
  });
  const loyalty = await getLoyaltyConfig(table.restaurantId);
  return {
    restaurant: { name: restaurant.name, logoUrl: restaurant.logoUrl, currency: restaurant.currency },
    table: { number: table.number },
    loyalty: loyalty.enabled ? { earnPercent: loyalty.earnPercent, pointValue: loyalty.pointValue } : null,
    categories: categories
      .filter((c) => c.items.length > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: c.items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          price: Number(i.price),
          foodType: i.foodType,
          imageUrl: i.imageUrl,
          popular: i.popular,
          featured: i.featured,
          available: i.available,
        })),
      })),
  };
}

export async function createGuestOrderRequest(token: string, input: GuestRequestInput) {
  const table = await resolveTable(token);
  const pending = await prisma.guestRequest.count({ where: { tableId: table.id, status: "PENDING", kind: "ORDER" } });
  if (pending >= MAX_PENDING_PER_TABLE) {
    throw AppError.conflict("Your earlier orders are still waiting for a staff member. They'll be with you shortly.");
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: input.items.map((i) => i.menuItemId) }, restaurantId: table.restaurantId, deletedAt: null },
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  const items: RequestItem[] = input.items.map((line) => {
    const m = byId.get(line.menuItemId);
    if (!m) throw AppError.badRequest("One of the dishes is no longer on the menu. Please refresh the menu.");
    if (!m.available) throw AppError.conflict(`Sorry, ${m.name} is not available right now.`);
    return { menuItemId: m.id, name: m.name, price: Number(m.price), quantity: line.quantity, notes: line.notes?.trim() || null };
  });

  const customerId = input.guestPhone ? await findOrCreateGuestCustomer(table.restaurantId, input.guestPhone, input.guestName) : null;

  const request = await prisma.guestRequest.create({
    data: {
      restaurantId: table.restaurantId,
      tableId: table.id,
      kind: "ORDER",
      items: JSON.stringify(items),
      note: input.note?.trim() || null,
      guestName: input.guestName?.trim() || null,
      guestPhone: input.guestPhone ? normalizePhone(input.guestPhone) : null,
      customerId,
    },
  });
  emitRealtime(REALTIME_EVENTS.GUEST_REQUEST_CREATED, { requestId: request.id, tableNumber: table.number, kind: "ORDER" });
  return { requestId: request.id };
}

export async function requestBill(token: string) {
  const table = await resolveTable(token);
  const existing = await prisma.guestRequest.findFirst({ where: { tableId: table.id, kind: "BILL", status: "PENDING" } });
  if (existing) return { requestId: existing.id };
  const request = await prisma.guestRequest.create({ data: { restaurantId: table.restaurantId, tableId: table.id, kind: "BILL" } });
  emitRealtime(REALTIME_EVENTS.GUEST_REQUEST_CREATED, { requestId: request.id, tableNumber: table.number, kind: "BILL" });
  return { requestId: request.id };
}

/**
 * What the guest's phone shows: their requests and, once accepted, each
 * dish's progress and the running bill. No staff names, other customers'
 * details, or payment information are exposed.
 */
export async function getGuestStatus(token: string) {
  const table = await resolveTable(token);
  const order = await prisma.order.findFirst({ where: { tableId: table.id, ...ACTIVE_ORDER_FILTER }, include: { items: { orderBy: { createdAt: "asc" } } } });
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const requests = await prisma.guestRequest.findMany({
    where: {
      tableId: table.id,
      OR: [{ status: "PENDING" }, ...(order ? [{ orderId: order.id }] : []), { status: "DECLINED", createdAt: { gte: since } }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return {
    requests: requests.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      items: r.kind === "ORDER" ? (JSON.parse(r.items) as RequestItem[]).map(({ name, quantity }) => ({ name, quantity })) : [],
      declineReason: r.declineReason,
      createdAt: r.createdAt.toISOString(),
    })),
    order: order
      ? {
          status: order.status,
          items: order.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity, kitchenStatus: i.kitchenStatus })),
          grandTotal: Number(order.grandTotal),
          payLinkToken: order.publicPayToken,
        }
      : null,
  };
}

async function findOrCreateGuestCustomer(restaurantId: string, phoneRaw: string, name?: string | null): Promise<string> {
  const phone = normalizePhone(phoneRaw);
  const existing = await prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId, phone } } });
  if (existing) return existing.id;
  const created = await prisma.customer.create({ data: { restaurantId, phone, name: name?.trim() || "Guest" } });
  return created.id;
}

// ─── Staff side ────────────────────────────────────────────────────────────

export async function listPendingRequests(restaurantId: string) {
  const requests = await prisma.guestRequest.findMany({
    where: { restaurantId, status: "PENDING" },
    include: { table: true, customer: true },
    orderBy: { createdAt: "asc" },
  });
  return requests.map((r) => {
    const items = r.kind === "ORDER" ? (JSON.parse(r.items) as RequestItem[]) : [];
    return {
      id: r.id,
      kind: r.kind,
      tableId: r.tableId,
      tableNumber: r.table.number,
      items,
      note: r.note,
      guestName: r.customer?.name ?? r.guestName,
      guestPhone: r.guestPhone,
      estimatedTotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/**
 * Staff accepts a guest's order: it joins the table's running bill (opening
 * one if needed) and goes straight to the kitchen as its own round.
 */
export async function acceptRequest(requestId: string, restaurantId: string, actorId: string) {
  const request = await prisma.guestRequest.findUnique({ where: { id: requestId }, include: { table: true } });
  if (!request || request.restaurantId !== restaurantId) throw AppError.notFound("Request not found");
  if (request.status !== "PENDING") throw AppError.conflict("Someone has already handled this request.");

  if (request.kind === "BILL") {
    await markHandled(requestId, "ACCEPTED", actorId, null);
    return { requestId, orderId: null };
  }

  const items = JSON.parse(request.items) as RequestItem[];
  const unavailable = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) }, OR: [{ available: false }, { deletedAt: { not: null } }] },
  });
  if (unavailable.length) {
    throw AppError.conflict(`${unavailable.map((m) => m.name).join(", ")} ${unavailable.length > 1 ? "are" : "is"} no longer available. Decline this request and let the guest know.`);
  }

  let order = await prisma.order.findFirst({ where: { tableId: request.tableId, ...ACTIVE_ORDER_FILTER } });
  if (order && ["PAYMENT_PENDING", "PAID"].includes(order.status)) {
    throw AppError.conflict(`Table ${request.table.number} is paying right now. Finish or cancel that payment first.`);
  }
  if (!order) {
    const created = await createOrder(restaurantId, actorId, { tableId: request.tableId, orderType: "DINE_IN", customerId: request.customerId });
    order = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
  } else if (!order.customerId && request.customerId) {
    // Guest identified themselves from their phone — link them so the bill earns points.
    order = await prisma.order.update({ where: { id: order.id }, data: { customerId: request.customerId } });
    await prisma.customer.update({ where: { id: request.customerId }, data: { visitCount: { increment: 1 } } });
  }

  for (const item of items) {
    await addOrderItem(order.id, { menuItemId: item.menuItemId, quantity: item.quantity, notes: item.notes }, actorId);
  }
  if (request.note) {
    const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const note = current.note ? `${current.note} · Guest: ${request.note}` : `Guest: ${request.note}`;
    await prisma.order.update({ where: { id: order.id }, data: { note } });
  }
  const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  if (fresh.status === "DRAFT") await confirmOrder(order.id, actorId);
  await sendToKitchen(order.id, actorId);

  await prisma.guestRequest.update({ where: { id: requestId }, data: { orderId: order.id } });
  await markHandled(requestId, "ACCEPTED", actorId, null);
  return { requestId, orderId: order.id };
}

export async function declineRequest(requestId: string, restaurantId: string, actorId: string, reason?: string | null) {
  const request = await prisma.guestRequest.findUnique({ where: { id: requestId } });
  if (!request || request.restaurantId !== restaurantId) throw AppError.notFound("Request not found");
  if (request.status !== "PENDING") throw AppError.conflict("Someone has already handled this request.");
  await markHandled(requestId, "DECLINED", actorId, reason?.trim() || null);
  return { requestId };
}

async function markHandled(requestId: string, status: "ACCEPTED" | "DECLINED", actorId: string, declineReason: string | null) {
  const updated = await prisma.guestRequest.update({
    where: { id: requestId },
    data: { status, handledById: actorId, handledAt: new Date(), declineReason },
  });
  await recordAudit({ userId: actorId, orderId: updated.orderId, action: `GUEST_REQUEST_${status}`, entity: "GuestRequest", entityId: requestId, metadata: { kind: updated.kind } });
  emitRealtime(REALTIME_EVENTS.GUEST_REQUEST_UPDATED, { requestId, status });
}

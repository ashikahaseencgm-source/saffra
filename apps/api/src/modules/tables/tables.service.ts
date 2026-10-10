import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type { TableDTO, TableStatus, OrderStatus } from "@saffra/types";
import { emitRealtime, REALTIME_EVENTS } from "../../lib/socket.js";
import { recordAudit } from "../audit/auditService.js";
// Includes PAID (not just the pre-payment statuses) so a table whose
// payment just captured still resolves to that order — otherwise the table
// sits at status "COMPLETED" with no currentOrderId, nothing to click, and
// no way back to AVAILABLE until someone hunts the order down in history.
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "SENT_TO_KITCHEN",
  "PREPARING",
  "READY",
  "SERVED",
  "PAYMENT_PENDING",
  "PAID",
] as const;

function toTableDTO(table: {
  id: string;
  number: number;
  capacity: number;
  status: string;
  orders: {
    id: string;
    grandTotal: unknown;
    createdAt: Date;
    waiter: { name: string };
    customerName: string | null;
    customer: { name: string } | null;
  }[];
}): TableDTO {
  const activeOrder = table.orders[0] ?? null;
  return {
    id: table.id,
    number: table.number,
    capacity: table.capacity,
    status: table.status as TableStatus,
    currentOrderId: activeOrder?.id ?? null,
    currentBillTotal: activeOrder ? Number(activeOrder.grandTotal) : 0,
    elapsedMinutes: activeOrder
      ? Math.max(0, Math.round((Date.now() - activeOrder.createdAt.getTime()) / 60000))
      : null,
    assignedWaiterName: activeOrder?.waiter.name ?? null,
    customerName: activeOrder?.customer?.name ?? activeOrder?.customerName ?? null,
  };
}

export async function listTables(restaurantId: string): Promise<TableDTO[]> {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId, deletedAt: null },
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: { status: { in: ACTIVE_ORDER_STATUSES } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { waiter: { select: { name: true } }, customer: { select: { name: true } } },
      },
    },
  });
  return tables.map(toTableDTO);
}

export async function getTable(id: string): Promise<TableDTO> {
  const table = await prisma.restaurantTable.findUnique({
    where: { id },
    include: {
      orders: {
        where: { status: { in: ACTIVE_ORDER_STATUSES } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { waiter: { select: { name: true } }, customer: { select: { name: true } } },
      },
    },
  });
  if (!table) throw AppError.notFound("Table not found");
  return toTableDTO(table);
}

export async function updateTableStatus(id: string, status: TableStatus, userId: string): Promise<TableDTO> {
  const table = await prisma.restaurantTable.update({ where: { id }, data: { status } });
  await recordAudit({ userId, action: "TABLE_STATUS_CHANGED", entity: "RestaurantTable", entityId: id, metadata: { status } });
  emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: table.id, status });
  return getTable(id);
}

export async function createTable(restaurantId: string, number: number, capacity: number) {
  const existing = await prisma.restaurantTable.findFirst({ where: { restaurantId, number, deletedAt: null } });
  if (existing) throw AppError.conflict(`Table ${number} already exists`);
  const table = await prisma.restaurantTable.create({ data: { restaurantId, number, capacity } });
  emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: table.id, status: table.status });
  return getTable(table.id);
}

export async function updateTable(id: string, data: { number?: number; capacity?: number }) {
  await prisma.restaurantTable.update({ where: { id }, data });
  return getTable(id);
}

export async function softDeleteTable(id: string) {
  await prisma.restaurantTable.update({ where: { id }, data: { deletedAt: new Date() } });
}

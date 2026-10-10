import { prisma } from "../../lib/prisma.js";
import type { DashboardStatsDTO, OrderStatus } from "@saffra/types";

const PAID_STATUSES: OrderStatus[] = ["PAID", "COMPLETED"];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardStats(restaurantId: string): Promise<DashboardStatsDTO> {
  const todayStart = startOfToday();

  const [todaysPaidOrders, activeTables, pendingPayments, kitchenOrders] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, status: { in: PAID_STATUSES }, createdAt: { gte: todayStart } },
      select: { grandTotal: true },
    }),
    prisma.restaurantTable.count({ where: { restaurantId, status: { not: "AVAILABLE" }, deletedAt: null } }),
    prisma.order.count({ where: { restaurantId, status: "PAYMENT_PENDING" } }),
    prisma.kitchenTicket.count({ where: { status: { not: "COMPLETED" }, order: { restaurantId } } }),
  ]);

  const todaysRevenue = todaysPaidOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
  const todaysOrders = todaysPaidOrders.length;

  return {
    todaysRevenue: round2(todaysRevenue),
    todaysOrders,
    activeTables,
    pendingPayments,
    kitchenOrders,
    averageBillValue: todaysOrders > 0 ? round2(todaysRevenue / todaysOrders) : 0,
  };
}

export async function getRevenueReport(restaurantId: string, from: Date, to: Date, bucket: "day" | "week" | "month" = "day") {
  const orders = await prisma.order.findMany({
    where: { restaurantId, status: { in: PAID_STATUSES }, createdAt: { gte: from, lte: to } },
    select: { grandTotal: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (const order of orders) {
    const key = bucketKey(order.createdAt, bucket);
    const existing = buckets.get(key) ?? { revenue: 0, orders: 0 };
    existing.revenue += Number(order.grandTotal);
    existing.orders += 1;
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, revenue: round2(v.revenue), orders: v.orders }));
}

function bucketKey(date: Date, bucket: "day" | "week" | "month"): string {
  if (bucket === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  if (bucket === "week") {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil(((date.getTime() - firstDayOfYear.getTime()) / 86400000 + firstDayOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return date.toISOString().slice(0, 10);
}

export async function getTopItems(restaurantId: string, limit = 10) {
  const items = await prisma.orderItem.findMany({
    where: { order: { restaurantId, status: { in: PAID_STATUSES } } },
    select: { nameSnapshot: true, quantity: true, priceSnapshot: true },
  });

  const map = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items) {
    const existing = map.get(item.nameSnapshot) ?? { name: item.nameSnapshot, quantity: 0, revenue: 0 };
    existing.quantity += item.quantity;
    existing.revenue += Number(item.priceSnapshot) * item.quantity;
    map.set(item.nameSnapshot, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit)
    .map((v) => ({ ...v, revenue: round2(v.revenue) }));
}

export async function getPaymentBreakdown(restaurantId: string) {
  const payments = await prisma.payment.findMany({
    where: { order: { restaurantId }, state: "CAPTURED" },
    select: { method: true, amount: true },
  });

  const map = new Map<string, { method: string; count: number; total: number }>();
  for (const p of payments) {
    const key = p.method ?? "UNKNOWN";
    const existing = map.get(key) ?? { method: key, count: 0, total: 0 };
    existing.count += 1;
    existing.total += Number(p.amount);
    map.set(key, existing);
  }
  return Array.from(map.values()).map((v) => ({ ...v, total: round2(v.total) }));
}

export async function getWaiterPerformance(restaurantId: string) {
  const orders = await prisma.order.findMany({
    where: { restaurantId, status: { in: PAID_STATUSES } },
    select: { waiterId: true, waiter: { select: { name: true, employeeId: true } }, grandTotal: true },
  });

  const map = new Map<string, { waiterId: string; name: string; employeeId: string; orders: number; revenue: number }>();
  for (const o of orders) {
    const existing = map.get(o.waiterId) ?? {
      waiterId: o.waiterId,
      name: o.waiter.name,
      employeeId: o.waiter.employeeId,
      orders: 0,
      revenue: 0,
    };
    existing.orders += 1;
    existing.revenue += Number(o.grandTotal);
    map.set(o.waiterId, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .map((v) => ({ ...v, revenue: round2(v.revenue), avgBill: round2(v.revenue / v.orders) }));
}

export async function getTableUtilization(restaurantId: string) {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId, deletedAt: null },
    include: {
      orders: {
        where: { status: { in: PAID_STATUSES } },
        select: { grandTotal: true, createdAt: true, completedAt: true },
      },
    },
    orderBy: { number: "asc" },
  });

  return tables.map((table) => {
    const revenue = table.orders.reduce((s, o) => s + Number(o.grandTotal), 0);
    return {
      tableId: table.id,
      number: table.number,
      ordersServed: table.orders.length,
      revenue: round2(revenue),
    };
  });
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

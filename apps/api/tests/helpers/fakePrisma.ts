import crypto from "node:crypto";

/**
 * A hand-rolled, in-memory stand-in for PrismaClient used only by tests. It
 * implements exactly the subset of the Prisma surface that orders/kitchen/
 * payments/receipts services call, backed by plain Maps, so the real
 * lifecycle test below exercises the REAL service/business logic (state
 * machine, billing recompute, payment capture) without needing a live
 * Postgres connection.
 *
 * `include`/`select` arguments are intentionally ignored — relations are
 * always attached — since tests only assert on fields they asked for.
 */
export function createFakePrisma() {
  const db = {
    restaurants: new Map<string, any>(),
    taxConfigs: new Map<string, any>(), // keyed by restaurantId
    tables: new Map<string, any>(),
    menuItems: new Map<string, any>(),
    orders: new Map<string, any>(),
    orderItems: new Map<string, any>(),
    discounts: new Map<string, any>(),
    kitchenTickets: new Map<string, any>(),
    payments: new Map<string, any>(),
    paymentAttempts: new Map<string, any>(),
    receipts: new Map<string, any>(), // keyed by orderId
    paymentGateways: new Map<string, any>(), // keyed by restaurantId
    customers: new Map<string, any>(),
    categories: new Map<string, any>(),
    guestRequests: new Map<string, any>(),
    loyaltyPrograms: new Map<string, any>(), // keyed by restaurantId
    loyaltyTiers: new Map<string, any>(),
    ledger: [] as any[],
    auditLogs: [] as any[],
  };

  const uid = () => crypto.randomUUID();
  const now = () => new Date();

  function hydrateOrder(order: any) {
    if (!order) return order;
    const items = Array.from(db.orderItems.values())
      .filter((i) => i.orderId === order.id)
      .map((i) => ({ ...i, menuItem: db.menuItems.get(i.menuItemId) }));
    const discounts = Array.from(db.discounts.values())
      .filter((d) => d.orderId === order.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const payments = Array.from(db.payments.values())
      .filter((p) => p.orderId === order.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      ...order,
      items,
      discounts,
      payments,
      table: order.tableId ? db.tables.get(order.tableId) ?? null : null,
      waiter: { id: order.waiterId, name: order.waiterName ?? "Test Waiter" },
      restaurant: db.restaurants.get(order.restaurantId),
    };
  }

  const prisma: any = {
    restaurant: {
      findFirst: async () => Array.from(db.restaurants.values())[0] ?? null,
      findUniqueOrThrow: async ({ where }: any) => {
        const row = db.restaurants.get(where.id);
        if (!row) throw new Error("Restaurant not found");
        return row;
      },
      create: async ({ data }: any) => {
        const row = { id: data.id ?? uid(), name: "Saffra Bistro", timezone: "Asia/Kolkata", invoicePrefix: "SAF", receiptFooter: "Thanks!", ...data };
        db.restaurants.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = { ...db.restaurants.get(where.id), ...data };
        db.restaurants.set(where.id, row);
        return row;
      },
    },
    taxConfiguration: {
      upsert: async ({ where, create, update }: any) => {
        const existing = db.taxConfigs.get(where.restaurantId);
        const row = existing
          ? { ...existing, ...update }
          : { id: uid(), cgstPercent: 2.5, sgstPercent: 2.5, serviceChargePercent: 5, ...create };
        db.taxConfigs.set(where.restaurantId, row);
        return row;
      },
    },
    restaurantTable: {
      findUnique: async ({ where }: any) =>
        where.qrToken ? Array.from(db.tables.values()).find((t) => t.qrToken === where.qrToken) ?? null : db.tables.get(where.id) ?? null,
      findMany: async ({ where }: any = {}) =>
        Array.from(db.tables.values())
          .filter((t) => (!where?.restaurantId || t.restaurantId === where.restaurantId) && !t.deletedAt)
          .sort((a, b) => a.number - b.number),
      findFirst: async ({ where }: any) =>
        Array.from(db.tables.values()).find((t) => t.restaurantId === where.restaurantId && t.number === where.number) ?? null,
      update: async ({ where, data }: any) => {
        const row = { ...db.tables.get(where.id), ...data };
        db.tables.set(where.id, row);
        return row;
      },
      create: async ({ data }: any) => {
        const row = { id: uid(), status: "AVAILABLE", ...data };
        db.tables.set(row.id, row);
        return row;
      },
    },
    menuItem: {
      findUnique: async ({ where }: any) => db.menuItems.get(where.id) ?? null,
      findMany: async ({ where }: any = {}) =>
        Array.from(db.menuItems.values()).filter((m) => {
          if (where?.id?.in && !where.id.in.includes(m.id)) return false;
          if (where?.restaurantId && m.restaurantId !== where.restaurantId) return false;
          if (where?.deletedAt === null && m.deletedAt) return false;
          if (where?.OR) return where.OR.some((c: any) => (c.available === false && !m.available) || (c.deletedAt?.not === null && m.deletedAt));
          return true;
        }),
    },
    menuCategory: {
      findMany: async ({ where }: any = {}) =>
        Array.from(db.categories.values())
          .filter((c) => !where?.restaurantId || c.restaurantId === where.restaurantId)
          .map((c) => ({ ...c, items: Array.from(db.menuItems.values()).filter((m) => m.categoryId === c.id && !m.deletedAt) })),
    },
    customer: {
      findUnique: async ({ where }: any) =>
        where.id
          ? db.customers.get(where.id) ?? null
          : Array.from(db.customers.values()).find(
              (c) => c.restaurantId === where.restaurantId_phone.restaurantId && c.phone === where.restaurantId_phone.phone,
            ) ?? null,
      findMany: async ({ where }: any = {}) => Array.from(db.customers.values()).filter((c) => !where?.restaurantId || c.restaurantId === where.restaurantId),
      create: async ({ data }: any) => {
        const row = { id: uid(), visitCount: 0, totalSpent: 0, createdAt: now(), updatedAt: now(), ...data };
        db.customers.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = db.customers.get(where.id);
        for (const [k, v] of Object.entries<any>(data)) row[k] = v && typeof v === "object" && "increment" in v ? Number(row[k] ?? 0) + v.increment : v;
        return row;
      },
    },
    guestRequest: {
      create: async ({ data }: any) => {
        const row = { id: uid(), kind: "ORDER", status: "PENDING", items: "[]", createdAt: now(), handledAt: null, orderId: null, declineReason: null, ...data };
        db.guestRequests.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        const row = db.guestRequests.get(where.id);
        return row ? { ...row, table: db.tables.get(row.tableId) } : null;
      },
      findFirst: async ({ where }: any) =>
        Array.from(db.guestRequests.values()).find((r) => r.tableId === where.tableId && r.kind === where.kind && r.status === where.status) ?? null,
      findMany: async ({ where }: any) =>
        Array.from(db.guestRequests.values())
          .filter((r) => {
            if (where.restaurantId && r.restaurantId !== where.restaurantId) return false;
            if (where.status && r.status !== where.status) return false;
            if (where.tableId && r.tableId !== where.tableId) return false;
            if (where.OR) return where.OR.some((c: any) => (c.status ? r.status === c.status : true) && (c.orderId ? r.orderId === c.orderId : true));
            return true;
          })
          .map((r) => ({ ...r, table: db.tables.get(r.tableId), customer: r.customerId ? db.customers.get(r.customerId) : null })),
      count: async ({ where }: any) =>
        Array.from(db.guestRequests.values()).filter((r) => r.tableId === where.tableId && r.status === where.status && r.kind === where.kind).length,
      update: async ({ where, data }: any) => {
        const row = { ...db.guestRequests.get(where.id), ...data };
        db.guestRequests.set(where.id, row);
        return row;
      },
    },
    loyaltyProgram: {
      upsert: async ({ where, create, update }: any) => {
        const existing = db.loyaltyPrograms.get(where.restaurantId);
        const defaults = { enabled: false, earnPercent: 5, pointValue: 1, minBillToEarn: 0, redeemMinPoints: 100, maxRedeemPercent: 50, expiryDays: 365, excludedCategoryIds: "[]", visitBonusEvery: 0, visitBonusPoints: 0, welcomeBonusPoints: 0 };
        const row = existing ? { ...existing, ...update } : { id: uid(), ...defaults, ...create };
        db.loyaltyPrograms.set(where.restaurantId, row);
        return row;
      },
    },
    loyaltyTier: {
      findMany: async ({ where }: any) => Array.from(db.loyaltyTiers.values()).filter((t) => t.restaurantId === where.restaurantId),
      deleteMany: async ({ where }: any) => {
        for (const [id, t] of db.loyaltyTiers) if (t.restaurantId === where.restaurantId) db.loyaltyTiers.delete(id);
        return {};
      },
      create: async ({ data }: any) => {
        const row = { id: uid(), ...data };
        db.loyaltyTiers.set(row.id, row);
        return row;
      },
    },
    loyaltyLedgerEntry: {
      create: async ({ data }: any) => {
        if (data.orderId && db.ledger.some((e) => e.orderId === data.orderId && e.type === data.type)) throw new Error("Unique constraint failed");
        const row = { id: uid(), createdAt: now(), expiresAt: null, note: null, orderId: null, ...data };
        db.ledger.push(row);
        return row;
      },
      findMany: async ({ where }: any) =>
        db.ledger.filter(
          (e) => (!where.customerId || e.customerId === where.customerId) && (!where.orderId || e.orderId === where.orderId) && (!where.points?.gt && where.points?.gt !== 0 ? true : e.points > where.points.gt),
        ),
      findFirst: async ({ where }: any) => db.ledger.find((e) => e.orderId === where.orderId && where.type.in.includes(e.type)) ?? null,
    },
    order: {
      findUnique: async ({ where }: any) => {
        if (where.id) return hydrateOrder(db.orders.get(where.id) ?? null);
        if (where.publicPayToken) {
          const row = Array.from(db.orders.values()).find((o: any) => o.publicPayToken === where.publicPayToken);
          return hydrateOrder(row ?? null);
        }
        return null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const row = db.orders.get(where.id);
        if (!row) throw new Error(`Order ${where.id} not found`);
        return hydrateOrder(row);
      },
      create: async ({ data }: any) => {
        const id = data.id ?? uid();
        const row = {
          id,
          status: "DRAFT",
          subtotal: 0,
          cgst: 0,
          sgst: 0,
          serviceCharge: 0,
          discountAmount: 0,
          discountReason: null,
          roundOff: 0,
          grandTotal: 0,
          createdAt: now(),
          updatedAt: now(),
          confirmedAt: null,
          completedAt: null,
          cancelledAt: null,
          note: null,
          customerName: null,
          customerId: null,
          loyaltyDiscount: 0,
          loyaltyPointsRedeemed: 0,
          publicPayToken: null,
          ...data,
        };
        db.orders.set(id, row);
        return hydrateOrder(row);
      },
      update: async ({ where, data }: any) => {
        const row = { ...db.orders.get(where.id), ...data, updatedAt: now() };
        db.orders.set(where.id, row);
        return hydrateOrder(row);
      },
      count: async ({ where }: any = {}) =>
        Array.from(db.orders.values()).filter(
          (o) => (!where?.customerId || o.customerId === where.customerId) && (!where?.status?.in || where.status.in.includes(o.status)),
        ).length,
      findMany: async () => Array.from(db.orders.values()).map(hydrateOrder),
      findFirst: async ({ where }: any) => {
        const match = Array.from(db.orders.values()).find((o) => {
          if (where.tableId && o.tableId !== where.tableId) return false;
          if (where.status?.notIn && where.status.notIn.includes(o.status)) return false;
          return true;
        });
        return match ? hydrateOrder(match) : null;
      },
    },
    orderItem: {
      create: async ({ data }: any) => {
        const row = { id: uid(), createdAt: now(), updatedAt: now(), kitchenStatus: "PENDING", ...data };
        db.orderItems.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = { ...db.orderItems.get(where.id), ...data, updatedAt: now() };
        db.orderItems.set(row.id, row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const row of db.orderItems.values()) {
          if (where.orderId && row.orderId !== where.orderId) continue;
          if (where.id?.in && !where.id.in.includes(row.id)) continue;
          if (where.kitchenStatus && row.kitchenStatus !== where.kitchenStatus) continue;
          Object.assign(row, data, { updatedAt: now() });
          count++;
        }
        return { count };
      },
      delete: async ({ where }: any) => {
        const row = db.orderItems.get(where.id);
        db.orderItems.delete(where.id);
        return row;
      },
    },
    discount: {
      create: async ({ data }: any) => {
        const row = { id: uid(), createdAt: now(), ...data };
        db.discounts.set(row.id, row);
        return row;
      },
    },
    kitchenTicket: {
      create: async ({ data }: any) => {
        const row = { id: uid(), round: 1, status: "NEW", createdAt: now(), updatedAt: now(), acceptedAt: null, readyAt: null, completedAt: null, ...data };
        db.kitchenTickets.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        const row = where.id
          ? db.kitchenTickets.get(where.id)
          : Array.from(db.kitchenTickets.values()).find((t: any) => t.orderId === where.orderId);
        if (!row) return null;
        return { ...row, order: hydrateOrder(db.orders.get(row.orderId)), orderId: row.orderId };
      },
      update: async ({ where, data }: any) => {
        const row = { ...db.kitchenTickets.get(where.id), ...data, updatedAt: now() };
        db.kitchenTickets.set(where.id, row);
        return row;
      },
      findMany: async ({ where }: any = {}) => {
        let rows = Array.from(db.kitchenTickets.values());
        if (where?.orderId) rows = rows.filter((t: any) => t.orderId === where.orderId);
        if (where?.status?.not) rows = rows.filter((t: any) => t.status !== where.status.not);
        if (where?.order?.restaurantId) {
          rows = rows.filter((t: any) => db.orders.get(t.orderId)?.restaurantId === where.order.restaurantId);
        }
        return rows.map((row: any) => ({ ...row, order: hydrateOrder(db.orders.get(row.orderId)) }));
      },
      count: async ({ where }: any = {}) =>
        Array.from(db.kitchenTickets.values()).filter((t: any) => !where?.orderId || t.orderId === where.orderId).length,
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const row of db.kitchenTickets.values()) {
          if (where.orderId && row.orderId !== where.orderId) continue;
          if (typeof where.status === "string" && row.status !== where.status) continue;
          if (where.status?.not && row.status === where.status.not) continue;
          Object.assign(row, data, { updatedAt: now() });
          count++;
        }
        return { count };
      },
    },
    payment: {
      create: async ({ data }: any) => {
        const row = { id: uid(), createdAt: now(), updatedAt: now(), capturedAt: null, state: "PENDING", ...data };
        db.payments.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: any) => db.payments.get(where.id) ?? null,
      findUniqueOrThrow: async ({ where }: any) => {
        const row = db.payments.get(where.id);
        if (!row) throw new Error("Payment not found");
        return row;
      },
      findFirst: async ({ where }: any) => {
        const all = Array.from(db.payments.values()).filter((p) => p.orderId === where.orderId);
        if (where.state?.in) return all.find((p) => where.state.in.includes(p.state)) ?? null;
        return all[0] ?? null;
      },
      update: async ({ where, data }: any) => {
        const row = { ...db.payments.get(where.id), ...data, updatedAt: now() };
        db.payments.set(where.id, row);
        return row;
      },
    },
    paymentGatewayConfig: {
      findFirst: async () => Array.from(db.paymentGateways.values())[0] ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = db.paymentGateways.get(where.restaurantId);
        const row = existing ? { ...existing, ...update, updatedAt: now() } : { id: uid(), createdAt: now(), updatedAt: now(), ...create };
        db.paymentGateways.set(where.restaurantId, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = { ...db.paymentGateways.get(where.restaurantId), ...data, updatedAt: now() };
        db.paymentGateways.set(where.restaurantId, row);
        return row;
      },
      deleteMany: async ({ where }: any) => {
        const had = db.paymentGateways.delete(where.restaurantId);
        return { count: had ? 1 : 0 };
      },
    },
    paymentAttempt: {
      create: async ({ data }: any) => {
        const row = { id: uid(), createdAt: now(), ...data };
        db.paymentAttempts.set(row.id, row);
        return row;
      },
    },
    receipt: {
      findUnique: async ({ where }: any) => db.receipts.get(where.orderId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = db.receipts.get(where.orderId);
        const row = existing ? { ...existing, ...update } : { id: uid(), createdAt: now(), printCount: 0, ...create };
        db.receipts.set(where.orderId, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = { ...db.receipts.get(where.orderId), ...data };
        db.receipts.set(where.orderId, row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        db.auditLogs.push({ id: uid(), createdAt: now(), ...data });
        return data;
      },
      findMany: async () => db.auditLogs,
    },
    $transaction: async (ops: any[]) => Promise.all(ops),
  };

  return { prisma, db };
}

/**
 * A ready-made singleton instance. Tests reference this directly (instead of
 * calling createFakePrisma() themselves) so that a `vi.mock` factory can
 * close over the same object the test file seeds data into — see
 * orders.lifecycle.test.ts for the pattern.
 */
export const fake = createFakePrisma();


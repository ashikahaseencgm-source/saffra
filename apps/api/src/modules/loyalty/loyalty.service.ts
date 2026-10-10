import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { emitRealtime, REALTIME_EVENTS } from "../../lib/socket.js";
import { recordAudit } from "../audit/auditService.js";
import { recalculateOrderBill, getOrder } from "../orders/orders.service.js";
import {
  bonusPoints,
  expiryFor,
  maxRedeemablePoints,
  nextTierFor,
  pointsBalance,
  pointsExpiringWithin,
  pointsToEarn,
  pointsValue,
  tierFor,
  type LoyaltyConfig,
} from "./loyaltyEngine.js";
import type { LoyaltyProgramInput } from "./loyalty.schema.js";

// Orders still open for changes to the bill (points can't change once a
// payment has started, or the amount charged would no longer match).
const REDEEMABLE_STATUSES = ["CONFIRMED", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED"];

export async function getLoyaltyConfig(restaurantId: string): Promise<LoyaltyConfig> {
  const program = await prisma.loyaltyProgram.upsert({ where: { restaurantId }, create: { restaurantId }, update: {} });
  const tiers = await prisma.loyaltyTier.findMany({ where: { restaurantId }, orderBy: { sortOrder: "asc" } });
  return {
    enabled: program.enabled,
    earnPercent: Number(program.earnPercent),
    pointValue: Number(program.pointValue),
    minBillToEarn: Number(program.minBillToEarn),
    redeemMinPoints: program.redeemMinPoints,
    maxRedeemPercent: Number(program.maxRedeemPercent),
    expiryDays: program.expiryDays,
    excludedCategoryIds: safeJsonArray(program.excludedCategoryIds),
    visitBonusEvery: program.visitBonusEvery,
    visitBonusPoints: program.visitBonusPoints,
    welcomeBonusPoints: program.welcomeBonusPoints,
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name,
      minSpend: Number(t.minSpend),
      minVisits: t.minVisits,
      earnPercent: Number(t.earnPercent),
      color: t.color,
    })),
  };
}

export async function updateLoyaltyConfig(restaurantId: string, input: LoyaltyProgramInput, actorId: string): Promise<LoyaltyConfig> {
  const { tiers, excludedCategoryIds, ...fields } = input;
  await prisma.loyaltyProgram.upsert({
    where: { restaurantId },
    create: { restaurantId, ...fields, excludedCategoryIds: JSON.stringify(excludedCategoryIds ?? []) },
    update: { ...fields, ...(excludedCategoryIds ? { excludedCategoryIds: JSON.stringify(excludedCategoryIds) } : {}) },
  });
  if (tiers) {
    // Tiers are derived from spend/visits on the fly, so replacing them is
    // safe: guests simply re-qualify against the new rules.
    await prisma.$transaction([
      prisma.loyaltyTier.deleteMany({ where: { restaurantId } }),
      ...tiers.map((t, i) =>
        prisma.loyaltyTier.create({
          data: { restaurantId, name: t.name, minSpend: t.minSpend, minVisits: t.minVisits, earnPercent: t.earnPercent, color: t.color, sortOrder: i },
        }),
      ),
    ]);
  }
  await recordAudit({ userId: actorId, action: "LOYALTY_PROGRAM_UPDATED", entity: "LoyaltyProgram", metadata: { ...input } });
  return getLoyaltyConfig(restaurantId);
}

export interface CustomerLoyaltyDTO {
  enabled: boolean;
  customerId: string;
  name: string;
  phone: string;
  points: number;
  pointsValue: number;
  pointValue: number;
  expiringSoon: number;
  totalSpent: number;
  visits: number;
  tier: { name: string; color: string; earnPercent: number } | null;
  nextTier: { name: string; spendNeeded: number; visitsNeeded: number } | null;
  earnPercent: number;
  redeemMinPoints: number;
  history: { type: string; points: number; note: string | null; createdAt: string }[];
}

export async function getCustomerLoyalty(customerId: string, config?: LoyaltyConfig): Promise<CustomerLoyaltyDTO> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw AppError.notFound("Customer not found");
  const cfg = config ?? (await getLoyaltyConfig(customer.restaurantId));
  const entries = await prisma.loyaltyLedgerEntry.findMany({ where: { customerId }, orderBy: { createdAt: "asc" } });
  const points = pointsBalance(entries);
  const totalSpent = Number(customer.totalSpent);
  const tier = tierFor(cfg.tiers, totalSpent, customer.visitCount);
  const next = nextTierFor(cfg.tiers, totalSpent, customer.visitCount);
  return {
    enabled: cfg.enabled,
    customerId,
    name: customer.name,
    phone: customer.phone,
    points,
    pointsValue: pointsValue(cfg, points),
    pointValue: cfg.pointValue,
    expiringSoon: pointsExpiringWithin(entries, 30),
    totalSpent,
    visits: customer.visitCount,
    tier: tier ? { name: tier.name, color: tier.color, earnPercent: tier.earnPercent } : null,
    nextTier: next ? { name: next.tier.name, spendNeeded: next.spendNeeded, visitsNeeded: next.visitsNeeded } : null,
    earnPercent: tier?.earnPercent ?? cfg.earnPercent,
    redeemMinPoints: cfg.redeemMinPoints,
    history: entries
      .slice(-20)
      .reverse()
      .map((e) => ({ type: e.type, points: e.points, note: e.note, createdAt: e.createdAt.toISOString() })),
  };
}

/** Members list for the Loyalty page: everyone with points, a tier, or spend. */
export async function listMembers(restaurantId: string) {
  const config = await getLoyaltyConfig(restaurantId);
  const customers = await prisma.customer.findMany({ where: { restaurantId }, orderBy: { totalSpent: "desc" }, take: 200 });
  const members = await Promise.all(customers.map((c) => getCustomerLoyalty(c.id, config)));
  return members.map(({ history: _history, ...m }) => m);
}

/** What the bill screen needs to offer "Use points". */
export async function getOrderLoyalty(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.notFound("Order not found");
  const config = await getLoyaltyConfig(order.restaurantId);
  const earned = await prisma.loyaltyLedgerEntry.findMany({ where: { orderId, points: { gt: 0 } } });
  if (!order.customerId) {
    return { enabled: config.enabled, customer: null, maxRedeemablePoints: 0, appliedPoints: 0, earnedPoints: 0 };
  }
  const customer = await getCustomerLoyalty(order.customerId, config);
  // The cap is on the bill before points (the points already applied are added back).
  const billBeforePoints = Number(order.subtotal) - Number(order.discountAmount) + Number(order.loyaltyDiscount);
  const available = customer.points; // points aren't deducted until the bill is paid
  return {
    enabled: config.enabled,
    customer,
    maxRedeemablePoints: maxRedeemablePoints(config, available, billBeforePoints),
    appliedPoints: order.loyaltyPointsRedeemed,
    earnedPoints: earned.reduce((sum, e) => sum + e.points, 0),
  };
}

/** Spend (or with 0, remove) points on an open bill. Recorded in the ledger only once the bill is paid. */
export async function applyPoints(orderId: string, points: number, actorId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.notFound("Order not found");
  if (!REDEEMABLE_STATUSES.includes(order.status)) {
    throw AppError.conflict(
      order.status === "PAYMENT_PENDING"
        ? "Payment has already started for this bill. Cancel the payment first to change points."
        : "Points can't be changed on this bill any more.",
    );
  }
  if (!order.customerId) throw AppError.badRequest("Add the guest's phone number to this order to use their points.");
  const config = await getLoyaltyConfig(order.restaurantId);
  if (!config.enabled) throw AppError.conflict("The loyalty program is switched off.");

  if (points > 0) {
    const { maxRedeemablePoints: max, customer } = await getOrderLoyalty(orderId);
    if (customer && customer.points < config.redeemMinPoints) {
      throw AppError.badRequest(`Points can be used once the guest has at least ${config.redeemMinPoints}.`);
    }
    if (points > max) throw AppError.badRequest(`At most ${max} points can be used on this bill.`);
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { loyaltyPointsRedeemed: points, loyaltyDiscount: pointsValue(config, points) },
  });
  await recalculateOrderBill(orderId);
  await recordAudit({ userId: actorId, orderId, action: points > 0 ? "LOYALTY_POINTS_APPLIED" : "LOYALTY_POINTS_REMOVED", entity: "Order", entityId: orderId, metadata: { points } });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
  return getOrder(orderId);
}

/**
 * Before a payment starts: make sure the guest still has the points this bill
 * is spending (they might have used them at another table meanwhile).
 */
export async function assertPointsStillAvailable(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.customerId || !order.loyaltyPointsRedeemed) return;
  const entries = await prisma.loyaltyLedgerEntry.findMany({ where: { customerId: order.customerId } });
  if (pointsBalance(entries) < order.loyaltyPointsRedeemed) {
    throw AppError.conflict("The guest no longer has enough points for this bill. Remove the points and try again.");
  }
}

/**
 * Called exactly once when a bill is paid: updates lifetime spend, then (if
 * the program is on) records the points spent and earned. Idempotent per
 * order via the ledger's (orderId, type) uniqueness.
 */
export async function onOrderPaid(orderId: string): Promise<{ earned: number; spent: number } | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { menuItem: true } } },
  });
  if (!order?.customerId) return null;
  const already = await prisma.loyaltyLedgerEntry.findFirst({ where: { orderId, type: { in: ["EARN", "REDEEM"] } } });
  if (already) return null;

  const paidAmount = Number(order.grandTotal);
  const customer = await prisma.customer.update({
    where: { id: order.customerId },
    data: { totalSpent: { increment: paidAmount } },
  });

  const config = await getLoyaltyConfig(order.restaurantId);
  if (!config.enabled) return null;

  const now = new Date();
  let spent = 0;
  if (order.loyaltyPointsRedeemed > 0) {
    spent = order.loyaltyPointsRedeemed;
    await prisma.loyaltyLedgerEntry.create({
      data: { customerId: customer.id, orderId, type: "REDEEM", points: -spent, note: `Used on bill ${order.orderNumber}` },
    });
  }

  // Points are earned on what the guest actually paid for, before tax:
  // excluded categories removed, discounts and points shared out evenly.
  const subtotal = Number(order.subtotal);
  const netBill = subtotal - Number(order.discountAmount);
  const excluded = new Set(config.excludedCategoryIds);
  const eligibleGross = order.items
    .filter((i) => !excluded.has(i.menuItem.categoryId))
    .reduce((sum, i) => sum + Number(i.priceSnapshot) * i.quantity, 0);
  const eligible = subtotal > 0 ? (eligibleGross * netBill) / subtotal : 0;

  const tier = tierFor(config.tiers, Number(customer.totalSpent), customer.visitCount);
  const paidVisits = await prisma.order.count({ where: { customerId: customer.id, status: { in: ["PAID", "COMPLETED"] } } });
  const earned = pointsToEarn(config, eligible, netBill, tier);
  const bonus = bonusPoints(config, paidVisits);
  const expiresAt = expiryFor(config, now);

  const credits: { type: string; points: number; note: string }[] = [
    { type: "EARN", points: earned, note: `Bill ${order.orderNumber}${tier ? ` · ${tier.name} rate` : ""}` },
    { type: "WELCOME", points: bonus.welcome, note: "Welcome bonus" },
    { type: "VISIT_BONUS", points: bonus.visit, note: `Visit #${paidVisits} bonus` },
  ];
  let total = 0;
  for (const c of credits) {
    if (c.points <= 0) continue;
    total += c.points;
    await prisma.loyaltyLedgerEntry.create({
      data: { customerId: customer.id, orderId, type: c.type, points: c.points, note: c.note, expiresAt },
    });
  }
  await recordAudit({ orderId, action: "LOYALTY_POINTS_EARNED", entity: "Customer", entityId: customer.id, metadata: { earned: total, spent } });
  return { earned: total, spent };
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

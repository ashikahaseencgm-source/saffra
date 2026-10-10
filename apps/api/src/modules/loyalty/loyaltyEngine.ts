/**
 * Pure loyalty maths — no database, so every rule is unit-tested in
 * isolation (tests/loyaltyEngine.test.ts). The service layer feeds it
 * config + ledger rows and persists what it returns.
 *
 * One currency of reward: points. A point is worth `pointValue` rupees, so
 * "points", "cashback" and "spend-based" programs are all the same engine
 * with different numbers. Tiers (by lifetime spend and/or visits) override
 * the earn rate; visit and welcome bonuses add flat points.
 */

export interface LoyaltyTierConfig {
  id: string;
  name: string;
  minSpend: number;
  minVisits: number;
  earnPercent: number;
  color: string;
}

export interface LoyaltyConfig {
  enabled: boolean;
  earnPercent: number;
  pointValue: number;
  minBillToEarn: number;
  redeemMinPoints: number;
  maxRedeemPercent: number;
  expiryDays: number;
  excludedCategoryIds: string[];
  visitBonusEvery: number;
  visitBonusPoints: number;
  welcomeBonusPoints: number;
  tiers: LoyaltyTierConfig[];
}

export interface LedgerLike {
  points: number;
  createdAt: Date;
  expiresAt: Date | null;
}

const qualifies = (t: LoyaltyTierConfig, spend: number, visits: number) => spend >= t.minSpend && visits >= t.minVisits;
const tierRank = (a: LoyaltyTierConfig, b: LoyaltyTierConfig) => a.minSpend - b.minSpend || a.minVisits - b.minVisits;

/** The best tier a guest has reached, or null if none (base rate applies). */
export function tierFor(tiers: LoyaltyTierConfig[], totalSpent: number, visits: number): LoyaltyTierConfig | null {
  const reached = tiers.filter((t) => qualifies(t, totalSpent, visits)).sort(tierRank);
  return reached.at(-1) ?? null;
}

/** The next tier up and what's still needed to reach it. */
export function nextTierFor(
  tiers: LoyaltyTierConfig[],
  totalSpent: number,
  visits: number,
): { tier: LoyaltyTierConfig; spendNeeded: number; visitsNeeded: number } | null {
  const next = tiers.filter((t) => !qualifies(t, totalSpent, visits)).sort(tierRank)[0];
  if (!next) return null;
  return {
    tier: next,
    spendNeeded: Math.max(0, round2(next.minSpend - totalSpent)),
    visitsNeeded: Math.max(0, next.minVisits - visits),
  };
}

/**
 * Points available right now. Redemptions use up the OLDEST unexpired points
 * first (FIFO), so expiry never takes points that were already spent, and a
 * guest is never shown points that have quietly expired.
 */
export function pointsBalance(entries: LedgerLike[], now: Date = new Date()): number {
  const lots: { remaining: number; expiresAt: Date | null }[] = [];
  const live = (lot: { expiresAt: Date | null }, at: Date) => !lot.expiresAt || lot.expiresAt > at;
  const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const e of sorted) {
    if (e.points > 0) {
      lots.push({ remaining: e.points, expiresAt: e.expiresAt });
      continue;
    }
    let need = -e.points;
    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.remaining <= 0 || !live(lot, e.createdAt)) continue;
      const used = Math.min(lot.remaining, need);
      lot.remaining -= used;
      need -= used;
    }
  }
  return lots.filter((l) => live(l, now)).reduce((sum, l) => sum + l.remaining, 0);
}

/** Points that will expire within `days` (for "50 points expire soon" nudges). */
export function pointsExpiringWithin(entries: LedgerLike[], days: number, now: Date = new Date()): number {
  const horizon = addDays(now, days);
  return pointsBalance(entries, now) - pointsBalance(entries, horizon);
}

/**
 * Points earned on a paid bill.
 * @param eligibleAmount pre-tax amount that earns points (excluded categories
 *   removed, discounts and redeemed points already taken off)
 * @param billAmount pre-tax bill after discounts, checked against minBillToEarn
 */
export function pointsToEarn(config: LoyaltyConfig, eligibleAmount: number, billAmount: number, tier: LoyaltyTierConfig | null): number {
  if (!config.enabled || eligibleAmount <= 0 || billAmount < config.minBillToEarn || config.pointValue <= 0) return 0;
  const rate = tier?.earnPercent ?? config.earnPercent;
  // Small epsilon so 5% of ₹1,000 is exactly 50 points, not 49.999…
  return Math.max(0, Math.floor((eligibleAmount * rate) / 100 / config.pointValue + 1e-9));
}

/** Bonus points for this paid visit (welcome on the first, plus every Nth). */
export function bonusPoints(config: LoyaltyConfig, paidVisitNumber: number): { welcome: number; visit: number } {
  if (!config.enabled) return { welcome: 0, visit: 0 };
  return {
    welcome: paidVisitNumber === 1 ? config.welcomeBonusPoints : 0,
    visit: config.visitBonusEvery > 0 && paidVisitNumber % config.visitBonusEvery === 0 ? config.visitBonusPoints : 0,
  };
}

/**
 * Most points a guest may spend on this bill: nothing until they've reached
 * the redemption threshold, then capped by their balance and by the
 * maximum share of the (pre-tax, after other discounts) bill.
 */
export function maxRedeemablePoints(config: LoyaltyConfig, balance: number, billAmount: number): number {
  if (!config.enabled || balance < config.redeemMinPoints || config.pointValue <= 0 || billAmount <= 0) return 0;
  const capByBill = Math.floor((billAmount * config.maxRedeemPercent) / 100 / config.pointValue + 1e-9);
  return Math.max(0, Math.min(balance, capByBill));
}

export function pointsValue(config: Pick<LoyaltyConfig, "pointValue">, points: number): number {
  return round2(points * config.pointValue);
}

/** Calendar-day expiry for points earned at `earnedAt` (null = never). */
export function expiryFor(config: Pick<LoyaltyConfig, "expiryDays">, earnedAt: Date): Date | null {
  return config.expiryDays > 0 ? addDays(earnedAt, config.expiryDays) : null;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

import { describe, it, expect } from "vitest";
import {
  bonusPoints,
  expiryFor,
  maxRedeemablePoints,
  nextTierFor,
  pointsBalance,
  pointsExpiringWithin,
  pointsToEarn,
  tierFor,
  type LoyaltyConfig,
} from "../src/modules/loyalty/loyaltyEngine.js";

const TIERS = [
  { id: "g", name: "Gold", minSpend: 30000, minVisits: 0, earnPercent: 8, color: "#EAB308" },
  { id: "b", name: "Bronze", minSpend: 5000, minVisits: 0, earnPercent: 2, color: "#B45309" },
  { id: "s", name: "Silver", minSpend: 15000, minVisits: 5, earnPercent: 5, color: "#94A3B8" },
];

const CONFIG: LoyaltyConfig = {
  enabled: true,
  earnPercent: 1,
  pointValue: 1,
  minBillToEarn: 200,
  redeemMinPoints: 100,
  maxRedeemPercent: 50,
  expiryDays: 365,
  excludedCategoryIds: [],
  visitBonusEvery: 5,
  visitBonusPoints: 50,
  welcomeBonusPoints: 25,
  tiers: TIERS,
};

const d = (s: string) => new Date(s);

describe("tiers", () => {
  it("picks the highest tier reached, regardless of the order they were configured in", () => {
    expect(tierFor(TIERS, 1000, 1)).toBeNull();
    expect(tierFor(TIERS, 5000, 1)?.name).toBe("Bronze");
    expect(tierFor(TIERS, 16000, 4)?.name).toBe("Bronze"); // Silver also needs 5 visits
    expect(tierFor(TIERS, 16000, 5)?.name).toBe("Silver");
    expect(tierFor(TIERS, 30000, 0)?.name).toBe("Gold");
  });

  it("says what's needed for the next tier", () => {
    expect(nextTierFor(TIERS, 12000, 3)).toEqual({ tier: TIERS[2], spendNeeded: 3000, visitsNeeded: 2 });
    expect(nextTierFor(TIERS, 40000, 9)).toBeNull();
  });
});

describe("earning", () => {
  it("uses the base rate, or the tier's rate once reached", () => {
    expect(pointsToEarn(CONFIG, 1000, 1000, null)).toBe(10);
    expect(pointsToEarn(CONFIG, 1000, 1000, TIERS[0]!)).toBe(80);
    expect(pointsToEarn({ ...CONFIG, earnPercent: 5 }, 1000, 1000, null)).toBe(50); // no float drift
  });

  it("respects point value, minimum bill and the on/off switch", () => {
    expect(pointsToEarn({ ...CONFIG, pointValue: 0.5 }, 1000, 1000, null)).toBe(20);
    expect(pointsToEarn(CONFIG, 150, 150, null)).toBe(0);
    expect(pointsToEarn({ ...CONFIG, enabled: false }, 1000, 1000, null)).toBe(0);
    expect(pointsToEarn(CONFIG, 0, 1000, null)).toBe(0); // everything was in excluded categories
  });

  it("gives the welcome bonus once and the visit bonus every Nth paid visit", () => {
    expect(bonusPoints(CONFIG, 1)).toEqual({ welcome: 25, visit: 0 });
    expect(bonusPoints(CONFIG, 4)).toEqual({ welcome: 0, visit: 0 });
    expect(bonusPoints(CONFIG, 5)).toEqual({ welcome: 0, visit: 50 });
    expect(bonusPoints(CONFIG, 10)).toEqual({ welcome: 0, visit: 50 });
    expect(bonusPoints({ ...CONFIG, visitBonusEvery: 0 }, 5)).toEqual({ welcome: 0, visit: 0 });
  });
});

describe("redeeming", () => {
  it("allows nothing below the threshold, then caps by balance and by share of the bill", () => {
    expect(maxRedeemablePoints(CONFIG, 99, 1000)).toBe(0);
    expect(maxRedeemablePoints(CONFIG, 120, 1000)).toBe(120);
    expect(maxRedeemablePoints(CONFIG, 900, 1000)).toBe(500); // 50% of ₹1000
    expect(maxRedeemablePoints({ ...CONFIG, pointValue: 2 }, 900, 1000)).toBe(250); // 250 pts = ₹500
  });
});

describe("balance with expiry", () => {
  const now = d("2026-10-05T12:00:00Z");

  it("adds earnings and subtracts redemptions", () => {
    const entries = [
      { points: 100, createdAt: d("2026-09-01"), expiresAt: null },
      { points: 40, createdAt: d("2026-09-10"), expiresAt: null },
      { points: -60, createdAt: d("2026-09-20"), expiresAt: null },
    ];
    expect(pointsBalance(entries, now)).toBe(80);
  });

  it("drops expired points, but never ones already spent (oldest are used first)", () => {
    const entries = [
      { points: 100, createdAt: d("2025-09-01"), expiresAt: d("2026-09-01") }, // expired by now
      { points: 50, createdAt: d("2026-03-01"), expiresAt: d("2027-03-01") },
      { points: -80, createdAt: d("2026-04-01"), expiresAt: null }, // used 80 of the OLD lot
    ];
    // Old lot: 20 left, then expired. New lot: 50 untouched.
    expect(pointsBalance(entries, now)).toBe(50);
    expect(pointsBalance(entries, d("2026-08-01"))).toBe(70);
  });

  it("a redemption can't use points that had already expired at that time", () => {
    const entries = [
      { points: 100, createdAt: d("2025-01-01"), expiresAt: d("2025-06-01") },
      { points: 30, createdAt: d("2026-01-01"), expiresAt: null },
      { points: -30, createdAt: d("2026-02-01"), expiresAt: null },
    ];
    expect(pointsBalance(entries, now)).toBe(0);
  });

  it("reports points about to expire", () => {
    const entries = [
      { points: 40, createdAt: d("2025-10-20"), expiresAt: d("2026-10-20") },
      { points: 60, createdAt: d("2026-06-01"), expiresAt: d("2027-06-01") },
    ];
    expect(pointsExpiringWithin(entries, 30, now)).toBe(40);
  });

  it("sets expiry by calendar days, or never", () => {
    expect(expiryFor(CONFIG, d("2024-02-29T10:00:00Z"))?.toISOString().slice(0, 10)).toBe("2025-02-28");
    expect(expiryFor({ expiryDays: 0 }, now)).toBeNull();
  });
});

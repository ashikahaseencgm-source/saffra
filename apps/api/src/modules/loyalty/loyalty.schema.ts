import { z } from "zod";

const money = z.number().min(0).max(10_000_000);

export const loyaltyTierSchema = z.object({
  name: z.string().trim().min(1).max(40),
  minSpend: money,
  minVisits: z.number().int().min(0).max(100_000),
  earnPercent: z.number().min(0).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#D63A5E"),
});

export const loyaltyProgramSchema = z.object({
  enabled: z.boolean().optional(),
  earnPercent: z.number().min(0).max(100).optional(),
  pointValue: z.number().positive().max(1000).optional(),
  minBillToEarn: money.optional(),
  redeemMinPoints: z.number().int().min(0).max(1_000_000).optional(),
  maxRedeemPercent: z.number().min(0).max(100).optional(),
  expiryDays: z.number().int().min(0).max(3650).optional(),
  excludedCategoryIds: z.array(z.string().uuid()).max(200).optional(),
  visitBonusEvery: z.number().int().min(0).max(1000).optional(),
  visitBonusPoints: z.number().int().min(0).max(1_000_000).optional(),
  welcomeBonusPoints: z.number().int().min(0).max(1_000_000).optional(),
  tiers: z.array(loyaltyTierSchema).max(10).optional(),
});
export type LoyaltyProgramInput = z.infer<typeof loyaltyProgramSchema>;

export const applyPointsSchema = z.object({
  points: z.number().int().min(0).max(1_000_000),
});

import { api } from "./client.js";
import type { OrderDTO } from "@saffra/types";

export interface LoyaltyTier {
  id?: string;
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
  tiers: LoyaltyTier[];
}

export interface CustomerLoyalty {
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
  history?: { type: string; points: number; note: string | null; createdAt: string }[];
}

export interface OrderLoyalty {
  enabled: boolean;
  customer: CustomerLoyalty | null;
  maxRedeemablePoints: number;
  appliedPoints: number;
  earnedPoints: number;
}

export const loyaltyApi = {
  program: () => api.get<LoyaltyConfig>("/loyalty/program"),
  saveProgram: (data: Partial<LoyaltyConfig>) => api.put<LoyaltyConfig>("/loyalty/program", data),
  members: () => api.get<CustomerLoyalty[]>("/loyalty/members"),
  customer: (id: string) => api.get<CustomerLoyalty>(`/loyalty/customers/${id}`),
  order: (orderId: string) => api.get<OrderLoyalty>(`/loyalty/orders/${orderId}`),
  applyPoints: (orderId: string, points: number) => api.post<OrderDTO>(`/loyalty/orders/${orderId}/points`, { points }),
};

import { api } from "./client.js";
import type { PaymentGatewayStatusDTO } from "@saffra/types";

export interface SettingsDTO {
  restaurant: {
    id: string;
    name: string;
    logoUrl: string | null;
    address: string | null;
    city: string | null;
    gstin: string | null;
    phone: string | null;
    email: string | null;
    currency: string;
    timezone: string;
    invoicePrefix: string;
    receiptFooter: string;
    /** Custom Wi-Fi name, or null when it follows the restaurant name. */
    localHostname: string | null;
    effectiveLocalHostname: string;
  };
  taxConfig: { cgstPercent: number; sgstPercent: number; serviceChargePercent: number };
  payment: {
    provider: string;
    razorpayConfigured: boolean;
    /** Public Razorpay key id handed to checkout.js; null in Demo mode. */
    keyId: string | null;
    /** Saved keys can't be read any more and must be re-entered. */
    needsAttention: boolean;
    statusLabel: string;
  };
}

export const settingsApi = {
  get: () => api.get<SettingsDTO>("/settings", { skipAuth: true }),
  update: (data: Record<string, unknown>) => api.patch<SettingsDTO>("/settings", data),
  getPaymentGateway: () => api.get<PaymentGatewayStatusDTO>("/settings/payment-gateway"),
  savePaymentGateway: (data: { keyId: string; keySecret: string }) =>
    api.put<{ status: PaymentGatewayStatusDTO; verified: boolean }>("/settings/payment-gateway", data),
  recheckPaymentGateway: () => api.post<{ status: PaymentGatewayStatusDTO; verified: boolean }>("/settings/payment-gateway/check"),
  removePaymentGateway: () => api.delete<PaymentGatewayStatusDTO>("/settings/payment-gateway"),
};

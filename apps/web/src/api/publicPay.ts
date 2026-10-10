import { api } from "./client.js";
import type { PaymentCreateResponseDTO, PaymentMethod } from "@saffra/types";

export interface PublicOrderSummary {
  orderNumber: string;
  restaurantName: string;
  tableLabel: string;
  status: string;
  alreadyPaid: boolean;
  items: { name: string; quantity: number; price: number; total: number }[];
  bill: {
    subtotal: number;
    cgst: number;
    sgst: number;
    serviceCharge: number;
    discountAmount: number;
    roundOff: number;
    grandTotal: number;
  };
}

// Mirrors paymentsApi's shape exactly so PaymentCheckoutModal can accept
// either implementation interchangeably via its `endpoints` prop.
export function publicPayApiFor(token: string) {
  const base = `/pay/${token}`;
  return {
    create: () => api.post<PaymentCreateResponseDTO>(base + "/create", undefined, { skipAuth: true }),
    demoProcess: (paymentId: string, method: PaymentMethod, outcome: "success" | "failure" | "pending") =>
      api.post<{ state: string; providerPaymentId: string; receiptId: string | null }>(
        base + "/demo/process",
        { paymentId, method, outcome },
        { skipAuth: true },
      ),
    verify: (data: {
      paymentId: string;
      providerOrderId: string;
      providerPaymentId: string;
      signature?: string;
      method?: PaymentMethod;
    }) => api.post<{ verified: boolean; state: string; receiptId: string | null }>(base + "/verify", data, { skipAuth: true }),
  };
}

export const publicPayApi = {
  getSummary: (token: string) => api.get<PublicOrderSummary>(`/pay/${token}`, { skipAuth: true }),
  downloadReceiptPdf: (token: string) => api.get<Blob>(`/pay/${token}/receipt.pdf`, { skipAuth: true, responseType: "blob" }),
  forToken: publicPayApiFor,
};

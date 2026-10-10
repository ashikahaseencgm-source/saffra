import { api } from "./client.js";
import type { PaymentCreateResponseDTO, PaymentMethod } from "@saffra/types";

export const paymentsApi = {
  create: (orderId: string) => api.post<PaymentCreateResponseDTO>("/payments/create", { orderId }),
  demoProcess: (paymentId: string, method: PaymentMethod, outcome: "success" | "failure" | "pending") =>
    api.post<{ state: string; providerPaymentId: string; receiptId: string | null }>("/payments/demo/process", {
      paymentId,
      method,
      outcome,
    }),
  verify: (data: {
    paymentId: string;
    providerOrderId: string;
    providerPaymentId: string;
    signature?: string;
    method?: PaymentMethod;
  }) => api.post<{ verified: boolean; state: string; receiptId: string | null }>("/payments/verify", data),
  cash: (orderId: string, amountReceived: number) =>
    api.post<{ paymentId: string; amountReceived: number; changeReturned: number; receiptId: string }>("/payments/cash", {
      orderId,
      amountReceived,
    }),
  refund: (paymentId: string, amount?: number) =>
    api.post<{ refundId: string; state: string; amount: number }>("/payments/refund", { paymentId, amount }),
  cancelPendingForReorder: (orderId: string) => api.post<void>("/payments/cancel-pending", { orderId }),
  get: (id: string) => api.get(`/payments/${id}`),
};

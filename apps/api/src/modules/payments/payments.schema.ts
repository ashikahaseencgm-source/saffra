import { z } from "zod";
import { PAYMENT_METHODS } from "@saffra/types";

export const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
});

export const demoProcessSchema = z.object({
  paymentId: z.string().uuid(),
  method: z.enum(PAYMENT_METHODS),
  outcome: z.enum(["success", "failure", "pending"]),
});

export const verifyPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  providerOrderId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  signature: z.string().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
});

export const cashPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amountReceived: z.number().positive(),
});

export const refundPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: z.string().max(200).optional(),
});

import { z } from "zod";
import { PAYMENT_METHODS } from "@saffra/types";

export const publicDemoProcessSchema = z.object({
  paymentId: z.string().uuid(),
  method: z.enum(PAYMENT_METHODS),
  outcome: z.enum(["success", "failure", "pending"]),
});

export const publicVerifySchema = z.object({
  paymentId: z.string().uuid(),
  providerOrderId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  signature: z.string().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
});

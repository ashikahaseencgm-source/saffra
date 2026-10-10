import { z } from "zod";

export const savePaymentGatewaySchema = z.object({
  keyId: z.string().trim().min(1).max(64),
  keySecret: z.string().trim().min(1).max(128),
});

export const updateSettingsSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  logoUrl: z.string().url().optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  gstin: z.string().max(20).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  currency: z.string().max(10).optional(),
  timezone: z.string().max(60).optional(),
  invoicePrefix: z.string().max(10).optional(),
  receiptFooter: z.string().max(200).optional(),
  // null/"" = follow the restaurant name.
  localHostname: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?)?$/, "Use only letters, numbers and dashes (no spaces), up to 40 characters.")
    .transform((v) => v || null)
    .optional()
    .nullable(),
  taxConfig: z
    .object({
      cgstPercent: z.number().min(0).max(50).optional(),
      sgstPercent: z.number().min(0).max(50).optional(),
      serviceChargePercent: z.number().min(0).max(50).optional(),
    })
    .optional(),
});

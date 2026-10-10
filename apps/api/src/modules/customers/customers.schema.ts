import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20)
  .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number");

export const lookupCustomerSchema = z.object({
  phone: phoneSchema,
});

export const createCustomerSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().min(2).max(120),
});

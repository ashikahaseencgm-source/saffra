import { z } from "zod";

// An empty/untouched optional field arrives as "" from the wizard's form
// state, not undefined — treat that the same as "not provided" rather than
// failing format checks like .email() against an empty string.
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalText = (max: number) => z.preprocess(blankToNull, z.string().max(max).nullable().optional());

export const completeSetupSchema = z.object({
  restaurant: z.object({
    name: z.string().min(2).max(120),
    address: optionalText(200),
    city: optionalText(100),
    gstin: optionalText(20),
    phone: optionalText(20),
    email: z.preprocess(blankToNull, z.string().email().nullable().optional()),
  }),
  tax: z.object({
    cgstPercent: z.number().min(0).max(50),
    sgstPercent: z.number().min(0).max(50),
    serviceChargePercent: z.number().min(0).max(50),
  }),
  admin: z.object({
    name: z.string().min(2).max(120),
    employeeId: z.string().min(3).max(20),
    password: z.string().min(6).max(100),
  }),
  tableCount: z.number().int().min(1).max(200),
  loadSampleMenu: z.boolean().default(false),
});

export type CompleteSetupInput = z.infer<typeof completeSetupSchema>;

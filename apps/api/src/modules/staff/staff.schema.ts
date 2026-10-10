import { z } from "zod";
import { ROLES } from "@saffra/types";

export const createStaffSchema = z.object({
  employeeId: z.string().min(3).max(20),
  name: z.string().min(2).max(120),
  role: z.enum(ROLES),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6).max(100).default("password123"),
});

export const updateStaffSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  active: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6).max(100),
});

import { z } from "zod";

export const loginSchema = z.object({
  employeeId: z.string().min(3).max(20),
  password: z.string().min(6).max(100),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

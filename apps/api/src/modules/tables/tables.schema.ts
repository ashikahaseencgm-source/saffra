import { z } from "zod";
import { TABLE_STATUSES } from "@saffra/types";

export const updateTableStatusSchema = z.object({
  status: z.enum(TABLE_STATUSES),
});

export const createTableSchema = z.object({
  number: z.number().int().positive(),
  capacity: z.number().int().positive().max(20),
});

export const updateTableSchema = z.object({
  number: z.number().int().positive().optional(),
  capacity: z.number().int().positive().max(20).optional(),
});

import { z } from "zod";
import { ORDER_TYPES } from "@saffra/types";

export const createOrderSchema = z.object({
  tableId: z.string().uuid().optional().nullable(),
  orderType: z.enum(ORDER_TYPES).default("DINE_IN"),
  customerName: z.string().max(120).optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
});

export const updateOrderSchema = z.object({
  note: z.string().max(500).optional().nullable(),
  customerName: z.string().max(120).optional().nullable(),
  orderType: z.enum(ORDER_TYPES).optional(),
});

export const addOrderItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50).default(1),
  notes: z.string().max(200).optional().nullable(),
});

export const updateOrderItemSchema = z.object({
  quantity: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(200).optional().nullable(),
});

export const applyDiscountSchema = z.object({
  type: z.enum(["PERCENTAGE", "FLAT"]),
  value: z.number().positive(),
  reason: z.string().min(3).max(200),
});

export const orderQuerySchema = z.object({
  status: z.string().optional(),
  waiterId: z.string().uuid().optional(),
  tableId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  paymentStatus: z.string().optional(),
  /** Orders a cashier could bill right now — see PAYABLE_ORDER_STATUSES. */
  billable: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

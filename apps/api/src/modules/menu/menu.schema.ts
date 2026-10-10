import { z } from "zod";
import { FOOD_TYPES } from "@saffra/types";

export const createMenuItemSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).default(""),
  categoryId: z.string().uuid(),
  price: z.number().positive(),
  foodType: z.enum(FOOD_TYPES),
  imageUrl: z.string().url().optional().nullable(),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
  popular: z.boolean().default(false),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const menuQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  foodType: z.enum(FOOD_TYPES).optional(),
  available: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  popular: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(2).max(60),
  sortOrder: z.number().int().default(0),
});

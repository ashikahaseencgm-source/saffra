import { z } from "zod";

export const guestRequestSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        notes: z.string().max(200).optional().nullable(),
      }),
    )
    .min(1, "Add at least one dish")
    .max(30)
    .refine((items) => items.reduce((sum, i) => sum + i.quantity, 0) <= 60, "That's a very large order — please ask a staff member."),
  note: z.string().max(300).optional().nullable(),
  guestName: z.string().trim().max(60).optional().nullable(),
  // Optional: lets the restaurant recognise the guest and give loyalty points.
  guestPhone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{8,16}$/, "Please enter a valid phone number")
    .optional()
    .nullable()
    .or(z.literal("")),
});
export type GuestRequestInput = z.infer<typeof guestRequestSchema>;

export const declineRequestSchema = z.object({
  reason: z.string().max(200).optional().nullable(),
});

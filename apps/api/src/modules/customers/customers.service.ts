import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  // Keep a leading "+" (country code marker) but strip everything else
  // non-numeric, so "98765 43210", "98765-43210" and "9876543210" all match.
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

export interface CustomerLookupResult {
  found: boolean;
  customer: {
    id: string;
    phone: string;
    name: string;
    visitCount: number;
  } | null;
  previousOrder: {
    orderNumber: string;
    createdAt: string;
    grandTotal: number;
    items: { name: string; quantity: number }[];
  } | null;
}

export async function lookupCustomer(restaurantId: string, phoneRaw: string): Promise<CustomerLookupResult> {
  const phone = normalizePhone(phoneRaw);
  const customer = await prisma.customer.findUnique({
    where: { restaurantId_phone: { restaurantId, phone } },
  });

  if (!customer) {
    return { found: false, customer: null, previousOrder: null };
  }

  const lastOrder = await prisma.order.findFirst({
    where: { customerId: customer.id, status: { in: ["PAID", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return {
    found: true,
    customer: { id: customer.id, phone: customer.phone, name: customer.name, visitCount: customer.visitCount },
    previousOrder: lastOrder
      ? {
          orderNumber: lastOrder.orderNumber,
          createdAt: lastOrder.createdAt.toISOString(),
          grandTotal: Number(lastOrder.grandTotal),
          items: lastOrder.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity })),
        }
      : null,
  };
}

export async function createCustomer(restaurantId: string, phoneRaw: string, name: string) {
  const phone = normalizePhone(phoneRaw);
  const existing = await prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId, phone } } });
  if (existing) throw AppError.conflict("A customer with this phone number already exists", { customerId: existing.id });

  return prisma.customer.create({ data: { restaurantId, phone, name } });
}

export async function recordVisit(customerId: string): Promise<void> {
  await prisma.customer.update({ where: { id: customerId }, data: { visitCount: { increment: 1 } } });
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw AppError.notFound("Customer not found");
  return customer;
}

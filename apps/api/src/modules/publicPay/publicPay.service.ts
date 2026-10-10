import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { PAYABLE_ORDER_STATUSES } from "../orders/orders.service.js";
import type { OrderStatus } from "@saffra/types";

export async function resolvePayToken(token: string) {
  const order = await prisma.order.findUnique({ where: { publicPayToken: token } });
  if (!order) throw AppError.notFound("This payment link is invalid or has expired.");
  return order;
}

export async function getPublicOrderSummary(token: string) {
  const order = await prisma.order.findUnique({
    where: { publicPayToken: token },
    include: { items: true, table: true, restaurant: true },
  });
  if (!order) throw AppError.notFound("This payment link is invalid or has expired.");

  return {
    orderNumber: order.orderNumber,
    restaurantName: order.restaurant.name,
    tableLabel: order.table ? `Table ${order.table.number}` : order.orderType.replace("_", " "),
    status: order.status,
    alreadyPaid: order.status === "PAID" || order.status === "COMPLETED",
    items: order.items.map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
      price: Number(i.priceSnapshot),
      total: Number(i.priceSnapshot) * i.quantity,
    })),
    bill: {
      subtotal: Number(order.subtotal),
      cgst: Number(order.cgst),
      sgst: Number(order.sgst),
      serviceCharge: Number(order.serviceCharge),
      discountAmount: Number(order.discountAmount),
      roundOff: Number(order.roundOff),
      grandTotal: Number(order.grandTotal),
    },
  };
}

/** Resolves a token to its order id, regardless of the order's status — used
 * once payment is done and the customer just wants their receipt. */
export async function getOrderIdForToken(token: string): Promise<string> {
  const order = await resolvePayToken(token);
  return order.id;
}

/** Throws unless the order behind this token is currently payable. */
export async function assertTokenIsPayable(token: string): Promise<string> {
  const order = await resolvePayToken(token);
  if (!PAYABLE_ORDER_STATUSES.includes(order.status as OrderStatus)) {
    throw AppError.conflict("This order has already been paid or is no longer awaiting payment.");
  }
  return order.id;
}

/**
 * A token only ever authorizes actions on ITS OWN order — this stops a
 * customer with a valid link for their own order from passing an arbitrary
 * `paymentId` belonging to someone else's order into the demo/verify
 * endpoints.
 */
export async function assertPaymentBelongsToToken(token: string, paymentId: string): Promise<void> {
  const order = await resolvePayToken(token);
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.orderId !== order.id) {
    throw AppError.forbidden("This payment does not belong to the order behind this link.");
  }
}

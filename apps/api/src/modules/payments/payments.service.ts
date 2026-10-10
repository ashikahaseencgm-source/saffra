import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { getActivePaymentProvider, getProviderForPayment, demoPaymentProvider } from "./providers/index.js";
import { generateDemoPaymentId } from "../../utils/ids.js";
import { getOrCreateRestaurant } from "../settings/settings.service.js";
import { generateReceiptForOrder } from "../receipts/receiptService.js";
import { recordAudit } from "../audit/auditService.js";
import { emitRealtime, REALTIME_EVENTS } from "../../lib/socket.js";
import { PAYABLE_ORDER_STATUSES } from "../orders/orders.service.js";
import { assertPointsStillAvailable, onOrderPaid } from "../loyalty/loyalty.service.js";
import { logger } from "../../lib/logger.js";
import type { OrderStatus, PaymentCreateResponseDTO, PaymentProviderKind, PaymentMethod, PaymentVerifyRequestDTO } from "@saffra/types";

export async function createPayment(orderId: string, actorId: string | null): Promise<PaymentCreateResponseDTO> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw AppError.notFound("Order not found");
  if (!PAYABLE_ORDER_STATUSES.includes(order.status as OrderStatus)) {
    throw AppError.conflict(`Order in status ${order.status} is not ready for payment`);
  }
  if (order.items.some((i) => i.kitchenStatus === "PENDING")) {
    throw AppError.conflict("Send the new items to the kitchen before billing this order");
  }
  if (Number(order.grandTotal) <= 0) throw AppError.badRequest("Order total must be greater than zero");
  await assertPointsStillAvailable(orderId);

  const existingActive = await prisma.payment.findFirst({
    where: { orderId, state: { in: ["PENDING", "INITIATED", "AUTHORIZED"] } },
    orderBy: { createdAt: "desc" },
  });

  const restaurant = await getOrCreateRestaurant();
  let providerOrderId: string;
  let keyId: string | undefined;
  let paymentId: string;

  let providerKind: PaymentProviderKind;

  // Resume an unfinished attempt with the provider that started it. If the
  // payment settings changed since (e.g. Razorpay keys added or replaced),
  // that attempt can't be completed any more, so it's cancelled — nothing was
  // captured on it — and a fresh one is started with the current settings.
  let resumable = existingActive;
  const resumeProvider = existingActive ? await getProviderForPayment(existingActive.provider).catch(() => null) : null;
  if (existingActive && !resumeProvider) {
    await prisma.payment.update({
      where: { id: existingActive.id },
      data: { state: "CANCELLED", failureReason: "Payment settings changed before this attempt was finished" },
    });
    resumable = null;
  }

  if (resumable && resumeProvider) {
    paymentId = resumable.id;
    providerOrderId = resumable.providerOrderId;
    keyId = resumeProvider.publicKeyId;
    providerKind = resumeProvider.kind;
  } else {
    const provider = await getActivePaymentProvider();
    providerKind = provider.kind;
    const providerOrder = await provider.createOrder({
      amountRupees: Number(order.grandTotal),
      currency: "INR",
      receipt: order.orderNumber,
      notes: { orderId },
    });
    const payment = await prisma.payment.create({
      data: {
        orderId,
        provider: provider.kind,
        providerOrderId: providerOrder.providerOrderId,
        amount: order.grandTotal,
        state: "INITIATED",
      },
    });
    paymentId = payment.id;
    providerOrderId = providerOrder.providerOrderId;
    keyId = providerOrder.keyId;

    await prisma.order.update({ where: { id: orderId }, data: { status: "PAYMENT_PENDING" } });
    if (order.tableId) {
      await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "PAYMENT_PENDING" } });
      emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: order.tableId, status: "PAYMENT_PENDING" });
    }
    await recordAudit({ userId: actorId, orderId, action: "PAYMENT_INITIATED", entity: "Payment", entityId: payment.id });
  }

  return {
    paymentId,
    provider: providerKind,
    providerOrderId,
    amount: Number(order.grandTotal),
    currency: "INR",
    keyId,
    restaurantName: restaurant.name,
  };
}

async function finalizeCapturedPayment(paymentId: string, providerPaymentId: string, method: PaymentMethod | undefined, actorId: string | null) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

  // Idempotency: already captured, don't double-process (e.g. duplicate webhook/verify calls).
  if (payment.state === "CAPTURED") {
    const receipt = await prisma.receipt.findUnique({ where: { orderId: payment.orderId } });
    return { payment, receiptId: receipt?.id ?? null };
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { state: "CAPTURED", providerPaymentId, method: method ?? null, capturedAt: new Date() },
  });
  await prisma.paymentAttempt.create({ data: { paymentId, state: "CAPTURED", method: method ?? null } });

  const order = await prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
  await prisma.order.update({ where: { id: payment.orderId }, data: { status: "PAID" } });
  await awardLoyalty(payment.orderId);
  if (order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "COMPLETED" } });
    emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: order.tableId, status: "COMPLETED" });
  }

  const { receipt } = await generateReceiptForOrder(payment.orderId, paymentId);

  await recordAudit({ userId: actorId, orderId: payment.orderId, action: "PAYMENT_VERIFIED", entity: "Payment", entityId: paymentId });
  emitRealtime(REALTIME_EVENTS.PAYMENT_COMPLETED, { orderId: payment.orderId, paymentId });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId: payment.orderId });

  return { payment, receiptId: receipt.id };
}

async function markFailed(paymentId: string, orderId: string, reason: string, method: PaymentMethod | undefined, actorId: string | null) {
  await prisma.payment.update({ where: { id: paymentId }, data: { state: "FAILED", failureReason: reason, method: method ?? null } });
  await prisma.paymentAttempt.create({ data: { paymentId, state: "FAILED", method: method ?? null, message: reason } });
  await recordAudit({ userId: actorId, orderId, action: "PAYMENT_FAILED", entity: "Payment", entityId: paymentId, metadata: { reason } });
  emitRealtime(REALTIME_EVENTS.PAYMENT_FAILED, { orderId, paymentId, reason });
}

/** Demo-checkout-only: simulates the user picking a method and an outcome. */
export async function processDemoPayment(paymentId: string, method: PaymentMethod, outcome: "success" | "failure" | "pending", actorId: string | null) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw AppError.notFound("Payment not found");
  if (payment.provider !== "DEMO") throw AppError.forbidden("This endpoint is only available in Demo Payment Mode");

  const providerPaymentId = generateDemoPaymentId();
  demoPaymentProvider.recordSimulatedOutcome(providerPaymentId, outcome, method);

  if (outcome === "success") {
    const { receiptId } = await finalizeCapturedPayment(paymentId, providerPaymentId, method, actorId);
    return { state: "CAPTURED" as const, providerPaymentId, receiptId };
  }

  if (outcome === "pending") {
    await prisma.payment.update({ where: { id: paymentId }, data: { state: "AUTHORIZED", providerPaymentId, method } });
    await prisma.paymentAttempt.create({ data: { paymentId, state: "AUTHORIZED", method } });
    return { state: "AUTHORIZED" as const, providerPaymentId, receiptId: null };
  }

  await markFailed(paymentId, payment.orderId, "Payment declined (simulated)", method, actorId);
  return { state: "FAILED" as const, providerPaymentId, receiptId: null };
}

export async function verifyPayment(dto: PaymentVerifyRequestDTO, actorId: string | null) {
  const payment = await prisma.payment.findUnique({ where: { id: dto.paymentId } });
  if (!payment) throw AppError.notFound("Payment not found");

  if (payment.state === "CAPTURED") {
    const receipt = await prisma.receipt.findUnique({ where: { orderId: payment.orderId } });
    return { verified: true, state: "CAPTURED" as const, receiptId: receipt?.id ?? null };
  }

  const provider = await getProviderForPayment(payment.provider);
  const result = await provider.verifyPayment({
    providerOrderId: dto.providerOrderId,
    providerPaymentId: dto.providerPaymentId,
    signature: dto.signature,
    method: dto.method,
  });

  if (!result.valid || result.state !== "CAPTURED") {
    await markFailed(payment.id, payment.orderId, result.failureReason ?? "Payment verification failed", dto.method, actorId);
    return { verified: false, state: "FAILED" as const, receiptId: null, reason: result.failureReason };
  }

  const { receiptId } = await finalizeCapturedPayment(payment.id, dto.providerPaymentId, dto.method, actorId);
  return { verified: true, state: "CAPTURED" as const, receiptId };
}

export async function processCashPayment(orderId: string, amountReceived: number, cashierId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.notFound("Order not found");
  if (!PAYABLE_ORDER_STATUSES.includes(order.status as OrderStatus)) {
    throw AppError.conflict(`Order in status ${order.status} is not ready for payment`);
  }
  const grandTotal = Number(order.grandTotal);
  if (amountReceived < grandTotal) throw AppError.badRequest("Amount received is less than the grand total");
  await assertPointsStillAvailable(orderId);

  const payment = await prisma.payment.create({
    data: {
      orderId,
      provider: "DEMO",
      providerOrderId: `cash_${order.orderNumber}`,
      providerPaymentId: `cash_${Date.now()}`,
      amount: order.grandTotal,
      method: "CASH",
      state: "CAPTURED",
      amountReceived,
      changeReturned: Math.max(0, amountReceived - grandTotal),
      cashierId,
      capturedAt: new Date(),
    },
  });

  await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  await awardLoyalty(orderId);
  if (order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "COMPLETED" } });
    emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: order.tableId, status: "COMPLETED" });
  }

  const { receipt } = await generateReceiptForOrder(orderId, payment.id);
  await recordAudit({ userId: cashierId, orderId, action: "CASH_PAYMENT_COMPLETED", entity: "Payment", entityId: payment.id });
  emitRealtime(REALTIME_EVENTS.PAYMENT_COMPLETED, { orderId, paymentId: payment.id });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });

  return {
    paymentId: payment.id,
    amountReceived,
    changeReturned: Math.max(0, amountReceived - grandTotal),
    receiptId: receipt.id,
  };
}

export async function refundPayment(paymentId: string, amount: number | undefined, actorId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw AppError.notFound("Payment not found");
  if (payment.state !== "CAPTURED") throw AppError.conflict("Only captured payments can be refunded");

  const provider = await getProviderForPayment(payment.provider);
  const refundAmount = amount ?? Number(payment.amount);
  const result = await provider.refundPayment({
    providerPaymentId: payment.providerPaymentId ?? payment.providerOrderId,
    amountRupees: refundAmount,
  });

  await prisma.payment.update({
    where: { id: paymentId },
    data: { state: "REFUNDED", refundedAmount: refundAmount },
  });
  await recordAudit({ userId: actorId, orderId: payment.orderId, action: "PAYMENT_REFUNDED", entity: "Payment", entityId: paymentId, metadata: { amount: refundAmount } });

  return { refundId: result.refundId, state: result.state, amount: refundAmount };
}

export async function getPayment(id: string) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) throw AppError.notFound("Payment not found");
  return payment;
}

/**
 * A customer at a table is one running bill, not a new one every time they
 * ask for more food. If the order is PAYMENT_PENDING and the customer wants
 * to add something else, nothing has actually been charged yet — so the
 * right move is to cancel that pending attempt (not create a second order/
 * second bill) and reopen THIS SAME order so the addition lands on the same
 * total, to be billed together whenever they actually pay.
 */
export async function cancelPendingPaymentForReorder(orderId: string, actorId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.notFound("Order not found");
  if (order.status !== "PAYMENT_PENDING") {
    throw AppError.conflict("Only a payment-pending order can be reopened this way");
  }

  const pending = await prisma.payment.findFirst({
    where: { orderId, state: { in: ["PENDING", "INITIATED", "AUTHORIZED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (pending) {
    await prisma.payment.update({ where: { id: pending.id }, data: { state: "CANCELLED" } });
    await prisma.paymentAttempt.create({
      data: { paymentId: pending.id, state: "CANCELLED", message: "Cancelled to add more items to the same bill" },
    });
  }

  // SERVED is the safe landing status: items are editable from there, and
  // if the addition needs the kitchen again, adding the item already
  // reopens the ticket automatically (see reopenKitchenIfNeeded).
  await prisma.order.update({ where: { id: orderId }, data: { status: "SERVED" } });
  if (order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "READY_TO_SERVE" } });
    emitRealtime(REALTIME_EVENTS.TABLE_UPDATED, { tableId: order.tableId, status: "READY_TO_SERVE" });
  }

  await recordAudit({
    userId: actorId,
    orderId,
    action: "PAYMENT_CANCELLED_FOR_MORE_ITEMS",
    entity: "Order",
    entityId: orderId,
  });
  emitRealtime(REALTIME_EVENTS.ORDER_UPDATED, { orderId });
}

/**
 * Loyalty bookkeeping after a bill is paid. A loyalty problem must never undo
 * or block a payment that has already been taken, so failures are logged.
 */
async function awardLoyalty(orderId: string): Promise<void> {
  try {
    await onOrderPaid(orderId);
  } catch (err) {
    logger.error(`Couldn't update loyalty points for order ${orderId}`, err);
  }
}

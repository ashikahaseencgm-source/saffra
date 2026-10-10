import { prisma } from "../../lib/prisma.js";
import { generateReceiptNumber } from "../../utils/ids.js";
import { renderReceiptHtml } from "./receiptHtml.js";
import { renderReceiptPdfBuffer } from "./receiptPdf.js";
import type { ReceiptData, ReceiptLineItem } from "./receiptTypes.js";
import { AppError } from "../../lib/errors.js";
import { emitRealtime, REALTIME_EVENTS } from "../../lib/socket.js";

function mergeReceiptLines(items: ReceiptLineItem[]): ReceiptLineItem[] {
  const merged: ReceiptLineItem[] = [];
  for (const item of items) {
    const match = merged.find((m) => m.name === item.name && m.rate === item.rate);
    if (match) {
      match.quantity += item.quantity;
      match.total += item.total;
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  UPI: "UPI",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  CASH: "Cash",
  QR: "QR Code",
};

export async function generateReceiptForOrder(orderId: string, paymentId: string | null) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: true,
      table: true,
      waiter: true,
      customer: true,
      restaurant: true,
      payments: { where: paymentId ? { id: paymentId } : undefined, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const payment = order.payments[0] ?? null;
  const restaurant = order.restaurant;

  const data: ReceiptData = {
    restaurantName: restaurant.name,
    address: restaurant.address ? `${restaurant.address}${restaurant.city ? `, ${restaurant.city}` : ""}` : null,
    gstin: restaurant.gstin,
    phone: restaurant.phone,
    receiptNumber: generateReceiptNumber(restaurant.invoicePrefix),
    orderNumber: order.orderNumber,
    tableLabel: order.table ? `Table ${order.table.number}` : order.orderType.replace("_", " "),
    waiterName: order.waiter.name,
    customerName: order.customer?.name ?? order.customerName ?? null,
    dateLabel: new Date().toLocaleString("en-IN", { timeZone: restaurant.timezone }),
    // A repeat order (e.g. "another round" of a dish already served) is kept
    // as its own OrderItem row internally so the kitchen only ever sees the
    // new quantity — but the customer's receipt should read as one clean
    // line per dish, so identical name+rate rows are combined here.
    items: mergeReceiptLines(
      order.items.map((item) => ({
        name: item.nameSnapshot,
        quantity: item.quantity,
        rate: Number(item.priceSnapshot),
        total: Number(item.priceSnapshot) * item.quantity,
      })),
    ),
    subtotal: Number(order.subtotal),
    cgst: Number(order.cgst),
    sgst: Number(order.sgst),
    serviceCharge: Number(order.serviceCharge),
    discountAmount: Number(order.discountAmount),
    discountReason: order.discountReason,
    roundOff: Number(order.roundOff),
    grandTotal: Number(order.grandTotal),
    paymentMethod: payment?.method ? PAYMENT_METHOD_LABELS[payment.method] ?? payment.method : "Pending",
    transactionId: payment?.providerPaymentId ?? payment?.providerOrderId ?? "N/A",
    footer: restaurant.receiptFooter,
  };

  const html = renderReceiptHtml(data);

  const receipt = await prisma.receipt.upsert({
    where: { orderId },
    create: {
      orderId,
      paymentId: payment?.id ?? null,
      receiptNumber: data.receiptNumber,
      html,
    },
    update: { html, paymentId: payment?.id ?? null },
  });

  emitRealtime(REALTIME_EVENTS.RECEIPT_GENERATED, { orderId, receiptId: receipt.id });

  return { receipt, data };
}

export async function getReceiptHtml(orderId: string): Promise<string> {
  const existing = await prisma.receipt.findUnique({ where: { orderId } });
  if (existing) {
    await prisma.receipt.update({ where: { orderId }, data: { printCount: { increment: 1 } } });
    return existing.html;
  }
  const generated = await generateReceiptForOrder(orderId, null);
  return generated.receipt.html;
}

export async function getReceiptPdf(orderId: string): Promise<Buffer> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.notFound("Order not found");
  const { data } = await generateReceiptForOrder(orderId, null);
  return renderReceiptPdfBuffer(data);
}

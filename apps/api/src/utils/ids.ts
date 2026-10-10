import crypto from "node:crypto";

function randomAlphaNum(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i]! % chars.length];
  }
  return out;
}

export function generateOrderNumber(invoicePrefix = "SAF"): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${invoicePrefix}-${y}${m}${d}-${randomAlphaNum(4)}`;
}

export function generateTicketNumber(): string {
  return `KOT-${randomAlphaNum(5)}`;
}

export function generateReceiptNumber(invoicePrefix = "SAF"): string {
  return `${invoicePrefix}-RCPT-${randomAlphaNum(6)}`;
}

export function generateDemoOrderId(): string {
  return `order_demo_${randomAlphaNum(8)}`;
}

export function generateDemoPaymentId(): string {
  return `pay_demo_${randomAlphaNum(8)}`;
}

/** URL-safe token for a customer-facing public payment link (Order.publicPayToken). */
export function generatePayLinkToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

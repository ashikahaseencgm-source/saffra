import { describe, it, expect } from "vitest";
import { renderReceiptHtml } from "../src/modules/receipts/receiptHtml.js";
import { renderReceiptPdfBuffer } from "../src/modules/receipts/receiptPdf.js";
import type { ReceiptData } from "../src/modules/receipts/receiptTypes.js";

const sampleData: ReceiptData = {
  restaurantName: "Saffra Bistro",
  address: "24 Anna Salai, Chennai",
  gstin: "33ABCDE1234F1Z5",
  phone: "+91 44 4567 8901",
  receiptNumber: "SAF-RCPT-000001",
  orderNumber: "SAF-250917-AB12",
  tableLabel: "Table 8",
  waiterName: "Rahul Sharma",
  customerName: "Priya Menon",
  dateLabel: "17 Sep 2026, 8:30 PM",
  items: [
    { name: "Paneer Tikka", quantity: 2, rate: 280, total: 560 },
    { name: "Butter Naan", quantity: 4, rate: 60, total: 240 },
  ],
  subtotal: 800,
  cgst: 20,
  sgst: 20,
  serviceCharge: 40,
  discountAmount: 0,
  discountReason: null,
  roundOff: 0,
  grandTotal: 880,
  paymentMethod: "UPI",
  transactionId: "pay_demo_A82KD91",
  footer: "Thank you for dining with us. Visit again!",
};

describe("receipt rendering", () => {
  it("renders 80mm-width printable HTML containing all bill fields", () => {
    const html = renderReceiptHtml(sampleData);
    expect(html).toContain("80mm");
    expect(html).toContain("Saffra Bistro");
    expect(html).toContain("Priya Menon");
    expect(html).toContain("Paneer Tikka");
    expect(html).toContain("880.00");
    expect(html).toContain("pay_demo_A82KD91");
  });

  it("escapes HTML-unsafe characters in item names", () => {
    const html = renderReceiptHtml({
      ...sampleData,
      items: [{ name: "<script>alert(1)</script>", quantity: 1, rate: 10, total: 10 }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("generates a non-empty PDF buffer", async () => {
    const buffer = await renderReceiptPdfBuffer(sampleData);
    expect(buffer.length).toBeGreaterThan(500);
    // PDF magic bytes
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});

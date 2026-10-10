import { describe, it, expect } from "vitest";
import { computeBill } from "../src/modules/billing/billingEngine.js";

const TAX = { cgstPercent: 2.5, sgstPercent: 2.5, serviceChargePercent: 5 };

describe("billingEngine.computeBill", () => {
  it("computes subtotal, GST, service charge and grand total for a simple cart", () => {
    const bill = computeBill([{ price: 280, quantity: 2 }, { price: 60, quantity: 4 }], TAX);
    expect(bill.subtotal).toBe(800);
    expect(bill.cgst).toBe(20);
    expect(bill.sgst).toBe(20);
    expect(bill.gstTotal).toBe(40);
    expect(bill.serviceCharge).toBe(40);
    // 800 + 40 + 40 = 880 exactly -> no round off
    expect(bill.grandTotal).toBe(880);
    expect(bill.roundOff).toBe(0);
  });

  it("applies a percentage discount before computing tax", () => {
    const bill = computeBill([{ price: 1000, quantity: 1 }], TAX, { type: "PERCENTAGE", value: 10 });
    expect(bill.subtotal).toBe(1000);
    expect(bill.discountAmount).toBe(100);
    // taxable base = 900; cgst=22.5 sgst=22.5 service=45 => 990 exactly
    expect(bill.cgst).toBe(22.5);
    expect(bill.sgst).toBe(22.5);
    expect(bill.serviceCharge).toBe(45);
    expect(bill.grandTotal).toBe(990);
  });

  it("applies a flat discount and clamps it to the subtotal", () => {
    const bill = computeBill([{ price: 50, quantity: 1 }], TAX, { type: "FLAT", value: 500 });
    expect(bill.discountAmount).toBe(50);
    expect(bill.grandTotal).toBe(0);
  });

  it("rounds the grand total to the nearest whole rupee and keeps roundOff self-consistent", () => {
    const bill = computeBill([{ price: 133, quantity: 1 }], TAX);
    expect(Number.isInteger(bill.grandTotal)).toBe(true);
    const preRoundTotal = bill.subtotal - bill.discountAmount + bill.cgst + bill.sgst + bill.serviceCharge;
    expect(bill.roundOff).toBeCloseTo(bill.grandTotal - preRoundTotal, 2);
  });

  it("never produces a negative discount even with a discount larger than subtotal in flat mode", () => {
    const bill = computeBill([{ price: 10, quantity: 1 }], TAX, { type: "FLAT", value: 9999 });
    expect(bill.discountAmount).toBe(10);
    expect(bill.subtotal - bill.discountAmount).toBeGreaterThanOrEqual(0);
  });
});

describe("computeBill with loyalty points", () => {
  const TAX = { cgstPercent: 2.5, sgstPercent: 2.5, serviceChargePercent: 5 };

  it("takes points off after the regular discount and before tax", () => {
    const bill = computeBill([{ price: 1000, quantity: 1 }], TAX, { type: "PERCENTAGE", value: 10 }, 100);
    expect(bill.loyaltyDiscount).toBe(100);
    expect(bill.discountAmount).toBe(200); // 100 regular + 100 points
    expect(bill.cgst).toBe(20); // 2.5% of 800
    expect(bill.grandTotal).toBe(880);
  });

  it("never lets points take the bill below zero", () => {
    const bill = computeBill([{ price: 100, quantity: 1 }], TAX, { type: "FLAT", value: 60 }, 500);
    expect(bill.loyaltyDiscount).toBe(40);
    expect(bill.grandTotal).toBe(0);
  });
});

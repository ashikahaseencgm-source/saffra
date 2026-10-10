import type { DiscountType } from "@saffra/types";

export interface BillableItem {
  price: number;
  quantity: number;
}

export interface TaxConfigInput {
  cgstPercent: number;
  sgstPercent: number;
  serviceChargePercent: number;
}

export interface DiscountInput {
  type: DiscountType;
  value: number;
  reason?: string;
}

export interface BillBreakdown {
  subtotal: number;
  /** Everything taken off before tax: the regular discount plus loyalty. */
  discountAmount: number;
  loyaltyDiscount: number;
  cgst: number;
  sgst: number;
  gstTotal: number;
  serviceCharge: number;
  roundOff: number;
  grandTotal: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Server-side billing calculation. This is the ONLY place bill totals are
 * computed — the frontend never sends totals, only cart line items, and any
 * client-displayed total is a mirror of what this function would produce.
 *
 * Order of operations: discount is applied to the subtotal first, then GST
 * and service charge are computed on the discounted (taxable) base, then the
 * grand total is rounded to the nearest whole rupee with the delta recorded
 * as roundOff — standard Indian restaurant billing convention.
 */
export function computeBill(
  items: BillableItem[],
  taxConfig: TaxConfigInput,
  discount?: DiscountInput | null,
  /** Rupee value of loyalty points spent on this bill (applied after the regular discount, before tax). */
  loyaltyDiscount = 0,
): BillBreakdown {
  const subtotal = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));

  let discountAmount = 0;
  if (discount) {
    discountAmount =
      discount.type === "PERCENTAGE" ? (subtotal * discount.value) / 100 : discount.value;
    discountAmount = round2(Math.max(0, Math.min(discountAmount, subtotal)));
  }
  const appliedLoyalty = round2(Math.max(0, Math.min(loyaltyDiscount, subtotal - discountAmount)));
  discountAmount = round2(discountAmount + appliedLoyalty);

  const taxableBase = round2(subtotal - discountAmount);
  const cgst = round2((taxableBase * taxConfig.cgstPercent) / 100);
  const sgst = round2((taxableBase * taxConfig.sgstPercent) / 100);
  const gstTotal = round2(cgst + sgst);
  const serviceCharge = round2((taxableBase * taxConfig.serviceChargePercent) / 100);

  const totalBeforeRound = taxableBase + gstTotal + serviceCharge;
  const grandTotal = Math.round(totalBeforeRound);
  const roundOff = round2(grandTotal - totalBeforeRound);

  return {
    subtotal,
    discountAmount,
    loyaltyDiscount: appliedLoyalty,
    cgst,
    sgst,
    gstTotal,
    serviceCharge,
    roundOff,
    grandTotal,
  };
}

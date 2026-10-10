import { describe, it, expect } from "vitest";
import { DemoPaymentProvider } from "../src/modules/payments/providers/DemoPaymentProvider.js";

describe("DemoPaymentProvider", () => {
  it("creates an order with a realistic demo id and no real keyId", async () => {
    const provider = new DemoPaymentProvider();
    const order = await provider.createOrder({ amountRupees: 500, currency: "INR", receipt: "SAF-1" });
    expect(order.providerOrderId).toMatch(/^order_demo_/);
    expect(order.keyId).toBeUndefined();
    expect(order.amount).toBe(500);
  });

  it("simulated success produces a CAPTURED, valid verification result", async () => {
    const provider = new DemoPaymentProvider();
    provider.recordSimulatedOutcome("pay_demo_abc123", "success", "UPI");
    const result = await provider.verifyPayment({ providerOrderId: "order_demo_x", providerPaymentId: "pay_demo_abc123" });
    expect(result.valid).toBe(true);
    expect(result.state).toBe("CAPTURED");
  });

  it("simulated failure produces an invalid, FAILED verification result with a reason", async () => {
    const provider = new DemoPaymentProvider();
    provider.recordSimulatedOutcome("pay_demo_def456", "failure", "CREDIT_CARD");
    const result = await provider.verifyPayment({ providerOrderId: "order_demo_y", providerPaymentId: "pay_demo_def456" });
    expect(result.valid).toBe(false);
    expect(result.state).toBe("FAILED");
    expect(result.failureReason).toBeTruthy();
  });

  it("simulated pending produces an AUTHORIZED state", async () => {
    const provider = new DemoPaymentProvider();
    provider.recordSimulatedOutcome("pay_demo_ghi789", "pending", "NET_BANKING");
    const result = await provider.verifyPayment({ providerOrderId: "order_demo_z", providerPaymentId: "pay_demo_ghi789" });
    expect(result.state).toBe("AUTHORIZED");
  });

  it("getStatus reflects the recorded outcome, defaulting to PENDING when unknown", async () => {
    const provider = new DemoPaymentProvider();
    expect(await provider.getStatus("never_seen_id")).toBe("PENDING");
    provider.recordSimulatedOutcome("pay_demo_jkl000", "success", "WALLET");
    expect(await provider.getStatus("pay_demo_jkl000")).toBe("CAPTURED");
  });

  it("refundPayment returns a demo refund id and REFUNDED state", async () => {
    const provider = new DemoPaymentProvider();
    const result = await provider.refundPayment({ providerPaymentId: "pay_demo_abc123", amountRupees: 200 });
    expect(result.state).toBe("REFUNDED");
    expect(result.refundId).toMatch(/^rfnd_demo_/);
  });
});

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { RazorpayPaymentProvider, razorpayModeFromKeyId } from "../src/modules/payments/providers/RazorpayPaymentProvider.js";

const CREDS = { keyId: "rzp_test_abc123", keySecret: "test_secret_value_123", mode: "TEST" as const };

function sign(orderId: string, paymentId: string): string {
  return crypto.createHmac("sha256", CREDS.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
}

describe("RazorpayPaymentProvider.verifyPayment", () => {
  it("accepts a correctly-signed payment as CAPTURED", async () => {
    const provider = new RazorpayPaymentProvider(CREDS);
    const providerOrderId = "order_RZP_test123";
    const providerPaymentId = "pay_RZP_test456";
    const signature = sign(providerOrderId, providerPaymentId);

    const result = await provider.verifyPayment({ providerOrderId, providerPaymentId, signature });
    expect(result.valid).toBe(true);
    expect(result.state).toBe("CAPTURED");
  });

  it("rejects a payment with an incorrect signature", async () => {
    const provider = new RazorpayPaymentProvider(CREDS);
    const result = await provider.verifyPayment({
      providerOrderId: "order_RZP_test123",
      providerPaymentId: "pay_RZP_test456",
      signature: "0000000000000000000000000000000000000000000000000000000000000000",
    });
    expect(result.valid).toBe(false);
    expect(result.state).toBe("FAILED");
    expect(result.failureReason).toBeTruthy();
  });

  it("rejects a payment with no signature at all", async () => {
    const provider = new RazorpayPaymentProvider(CREDS);
    const result = await provider.verifyPayment({ providerOrderId: "order_x", providerPaymentId: "pay_y" });
    expect(result.valid).toBe(false);
  });

  it("never derives a signature from a payload sent by the frontend without checking it against the server secret", async () => {
    // Regression guard: a payment id/order id swap should NOT accidentally verify.
    const provider = new RazorpayPaymentProvider(CREDS);
    const signatureForDifferentPair = sign("order_A", "pay_A");
    const result = await provider.verifyPayment({
      providerOrderId: "order_B",
      providerPaymentId: "pay_B",
      signature: signatureForDifferentPair,
    });
    expect(result.valid).toBe(false);
  });
});

describe("razorpayModeFromKeyId", () => {
  it("reads test/live mode from the key id and rejects anything else", () => {
    expect(razorpayModeFromKeyId("rzp_test_abc123")).toBe("TEST");
    expect(razorpayModeFromKeyId("rzp_live_abc123")).toBe("LIVE");
    expect(razorpayModeFromKeyId("abc123")).toBeNull();
    expect(razorpayModeFromKeyId("rzp_test_")).toBeNull();
  });

  it("labels the provider kind from the key mode", () => {
    expect(new RazorpayPaymentProvider({ ...CREDS, mode: "LIVE" }).kind).toBe("RAZORPAY_LIVE");
    expect(new RazorpayPaymentProvider(CREDS).kind).toBe("RAZORPAY_TEST");
  });
});

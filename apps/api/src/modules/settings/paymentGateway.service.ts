import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { sealSecret } from "../../lib/secretBox.js";
import { recordAudit } from "../audit/auditService.js";
import { invalidatePaymentGatewayCache, resolvePaymentGateway } from "../payments/providers/index.js";
import { checkRazorpayCredentials, razorpayModeFromKeyId } from "../payments/providers/RazorpayPaymentProvider.js";
import type { PaymentGatewayStatusDTO } from "@saffra/types";

/** What the app may show about the payment setup. Never includes the key secret. */
export async function getPaymentGatewayStatus(): Promise<PaymentGatewayStatusDTO> {
  const gateway = await resolvePaymentGateway();
  const creds = gateway.credentials;
  return {
    source: gateway.source,
    provider: creds ? (creds.mode === "LIVE" ? "RAZORPAY_LIVE" : "RAZORPAY_TEST") : "DEMO",
    keyId: creds?.keyId ?? null,
    mode: creds?.mode ?? null,
    verifiedAt: gateway.verifiedAt?.toISOString() ?? null,
  };
}

export interface SaveGatewayResult {
  status: PaymentGatewayStatusDTO;
  /** false = saved, but Razorpay couldn't be reached to confirm the keys yet. */
  verified: boolean;
}

/**
 * Saves the restaurant's own Razorpay keys. Keys Razorpay actively rejects
 * are refused; if Razorpay can't be reached (no internet), they're saved
 * anyway and marked unverified, so setup is never blocked by a bad
 * connection — "Check connection" can confirm them later.
 */
export async function savePaymentGateway(
  restaurantId: string,
  input: { keyId: string; keySecret: string },
  actorId: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<SaveGatewayResult> {
  const keyId = input.keyId.trim();
  const keySecret = input.keySecret.trim();
  const mode = razorpayModeFromKeyId(keyId);
  if (!mode) {
    throw AppError.badRequest('That doesn\'t look like a Razorpay Key ID. It should start with "rzp_test_" or "rzp_live_".');
  }
  if (keySecret.length < 8) throw AppError.badRequest("Please paste the full Razorpay Key Secret.");

  const check = await checkRazorpayCredentials({ keyId, keySecret }, fetchImpl);
  if (check === "invalid") {
    throw AppError.badRequest("Razorpay didn't accept these keys. Copy both the Key ID and Key Secret again from your Razorpay dashboard.");
  }
  const verifiedAt = check === "valid" ? new Date() : null;

  const data = { provider: "RAZORPAY", keyId, keySecretEnc: sealSecret(keySecret), mode, verifiedAt };
  await prisma.paymentGatewayConfig.upsert({
    where: { restaurantId },
    create: { restaurantId, ...data },
    update: data,
  });
  invalidatePaymentGatewayCache();

  await recordAudit({
    userId: actorId,
    action: "PAYMENT_GATEWAY_SAVED",
    entity: "PaymentGatewayConfig",
    metadata: { keyId, mode, verified: check === "valid" },
  });

  return { status: await getPaymentGatewayStatus(), verified: check === "valid" };
}

/** Re-checks the saved keys against Razorpay (e.g. after saving them offline). */
export async function recheckPaymentGateway(restaurantId: string, fetchImpl: typeof fetch = fetch): Promise<SaveGatewayResult> {
  const gateway = await resolvePaymentGateway();
  if (gateway.source !== "SETTINGS" || !gateway.credentials) {
    throw AppError.conflict("No Razorpay keys have been saved yet.");
  }
  const check = await checkRazorpayCredentials(gateway.credentials, fetchImpl);
  if (check === "invalid") {
    throw AppError.badRequest("Razorpay no longer accepts the saved keys. Please enter them again.");
  }
  if (check === "valid") {
    await prisma.paymentGatewayConfig.update({ where: { restaurantId }, data: { verifiedAt: new Date() } });
    invalidatePaymentGatewayCache();
  }
  return { status: await getPaymentGatewayStatus(), verified: check === "valid" };
}

/** Back to Demo Payment Mode. Past payments and receipts are untouched. */
export async function removePaymentGateway(restaurantId: string, actorId: string | null): Promise<PaymentGatewayStatusDTO> {
  await prisma.paymentGatewayConfig.deleteMany({ where: { restaurantId } });
  invalidatePaymentGatewayCache();
  await recordAudit({ userId: actorId, action: "PAYMENT_GATEWAY_REMOVED", entity: "PaymentGatewayConfig" });
  return getPaymentGatewayStatus();
}

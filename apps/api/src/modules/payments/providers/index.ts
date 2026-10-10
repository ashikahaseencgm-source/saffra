import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../lib/errors.js";
import { logger } from "../../../lib/logger.js";
import { openSecret } from "../../../lib/secretBox.js";
import { demoPaymentProvider } from "./DemoPaymentProvider.js";
import { RazorpayPaymentProvider, razorpayModeFromKeyId, type RazorpayCredentials } from "./RazorpayPaymentProvider.js";
import type { PaymentProvider } from "./PaymentProvider.js";

/**
 * Where the active Razorpay keys came from:
 * - SETTINGS: the restaurant entered its own keys in Saffra (normal case).
 * - ENVIRONMENT: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars (dev/legacy).
 * - UNREADABLE: keys are saved but can't be decrypted (encryption key changed).
 * - NONE: Demo Payment Mode.
 */
export type PaymentGatewaySource = "SETTINGS" | "ENVIRONMENT" | "UNREADABLE" | "NONE";

interface ResolvedGateway {
  source: PaymentGatewaySource;
  credentials: RazorpayCredentials | null;
  verifiedAt: Date | null;
}

let cached: ResolvedGateway | null = null;

/** Call after the saved keys change so the next payment picks them up. */
export function invalidatePaymentGatewayCache(): void {
  cached = null;
}

export async function resolvePaymentGateway(): Promise<ResolvedGateway> {
  if (cached) return cached;

  const row = await prisma.paymentGatewayConfig.findFirst();
  if (row) {
    try {
      const keySecret = openSecret(row.keySecretEnc);
      cached = {
        source: "SETTINGS",
        credentials: { keyId: row.keyId, keySecret, mode: row.mode === "LIVE" ? "LIVE" : "TEST" },
        verifiedAt: row.verifiedAt,
      };
    } catch (err) {
      logger.error("Saved Razorpay key secret can't be decrypted — it must be entered again in Settings", err);
      cached = { source: "UNREADABLE", credentials: null, verifiedAt: null };
    }
    return cached;
  }

  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const mode = razorpayModeFromKeyId(env.RAZORPAY_KEY_ID) ?? (env.RAZORPAY_MODE === "live" ? "LIVE" : "TEST");
    cached = {
      source: "ENVIRONMENT",
      credentials: { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET, mode },
      verifiedAt: null,
    };
    return cached;
  }

  cached = { source: "NONE", credentials: null, verifiedAt: null };
  return cached;
}

/**
 * The single decision point for "which payment provider takes NEW payments".
 * Nobody else branches on keys or env vars. Saved Razorpay keys -> the
 * restaurant's own Razorpay; none -> Demo. Same REST contract and UI flow
 * either way.
 */
export async function getActivePaymentProvider(): Promise<PaymentProvider> {
  const gateway = await resolvePaymentGateway();
  if (gateway.source === "UNREADABLE") {
    // Never silently fall back to Demo here: on a real install that would
    // let a "simulated" payment mark a real bill as paid.
    throw AppError.serviceUnavailable(
      "Online payments need attention: please enter your Razorpay keys again in Settings. Cash payments still work.",
    );
  }
  return gateway.credentials ? new RazorpayPaymentProvider(gateway.credentials) : demoPaymentProvider;
}

/**
 * The provider that must verify / refund an EXISTING payment — the one that
 * created it, regardless of what's configured for new payments now. A demo
 * payment is never checked against Razorpay and vice versa.
 */
export async function getProviderForPayment(paymentProviderKind: string): Promise<PaymentProvider> {
  if (paymentProviderKind === "DEMO") return demoPaymentProvider;
  const active = await getActivePaymentProvider();
  if (active.kind === "DEMO") {
    throw AppError.conflict("This payment was made through Razorpay, but Razorpay isn't set up any more. Add your Razorpay keys in Settings.");
  }
  if (active.kind !== paymentProviderKind) {
    throw AppError.conflict("This payment was started with different Razorpay keys than the ones saved now, so it can't be checked here. Please check it in your Razorpay dashboard.");
  }
  return active;
}

export { demoPaymentProvider };
export type { PaymentProvider } from "./PaymentProvider.js";

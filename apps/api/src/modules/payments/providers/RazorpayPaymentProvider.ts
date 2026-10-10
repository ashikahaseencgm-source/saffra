import crypto from "node:crypto";
import { logger } from "../../../lib/logger.js";
import { AppError } from "../../../lib/errors.js";
import type {
  CreateProviderOrderParams,
  CreateProviderOrderResult,
  PaymentProvider,
  RefundPaymentParams,
  RefundPaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "./PaymentProvider.js";
import type { PaymentProviderKind, PaymentState } from "@saffra/types";

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  mode: "TEST" | "LIVE";
}

/** Razorpay key ids carry their mode: rzp_test_... or rzp_live_... */
export function razorpayModeFromKeyId(keyId: string): "TEST" | "LIVE" | null {
  if (/^rzp_test_[A-Za-z0-9]+$/.test(keyId)) return "TEST";
  if (/^rzp_live_[A-Za-z0-9]+$/.test(keyId)) return "LIVE";
  return null;
}

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

/**
 * Talks to the real Razorpay Orders/Payments REST API using the standard
 * checkout.js flow. Implemented with plain `fetch` + HTTP Basic Auth (no SDK
 * dependency) to keep the surface small and auditable. Secret key material
 * NEVER leaves this file / process — the frontend only ever receives a
 * `providerOrderId` and the public `keyId`.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly kind: PaymentProviderKind;
  readonly publicKeyId: string;

  constructor(private readonly credentials: RazorpayCredentials) {
    this.kind = credentials.mode === "LIVE" ? "RAZORPAY_LIVE" : "RAZORPAY_TEST";
    this.publicKeyId = credentials.keyId;
  }

  private authHeader(): string {
    const token = Buffer.from(`${this.credentials.keyId}:${this.credentials.keySecret}`).toString("base64");
    return `Basic ${token}`;
  }

  async createOrder(params: CreateProviderOrderParams): Promise<CreateProviderOrderResult> {
    const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: "POST",
      headers: { Authorization: this.authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(params.amountRupees * 100), // paise
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes ?? {},
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error("Razorpay createOrder failed", body);
      throw AppError.serviceUnavailable("Razorpay is currently unavailable. Please retry or use another payment method.");
    }

    const data = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      providerOrderId: data.id,
      amount: data.amount / 100,
      currency: data.currency,
      keyId: this.credentials.keyId,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    if (!params.signature) {
      return { valid: false, state: "FAILED", failureReason: "Missing payment signature" };
    }
    const expected = crypto
      .createHmac("sha256", this.credentials.keySecret)
      .update(`${params.providerOrderId}|${params.providerPaymentId}`)
      .digest("hex");

    const valid =
      expected.length === params.signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));

    if (!valid) {
      return { valid: false, state: "FAILED", failureReason: "Signature verification failed" };
    }
    return { valid: true, state: "CAPTURED" };
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    const res = await fetch(`${RAZORPAY_API_BASE}/payments/${params.providerPaymentId}/refund`, {
      method: "POST",
      headers: { Authorization: this.authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(params.amountRupees * 100) }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error("Razorpay refund failed", body);
      throw AppError.serviceUnavailable("Refund could not be processed via Razorpay right now.");
    }
    const data = (await res.json()) as { id: string };
    return { refundId: data.id, state: "REFUNDED" };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentState> {
    const res = await fetch(`${RAZORPAY_API_BASE}/payments/${providerPaymentId}`, {
      headers: { Authorization: this.authHeader() },
    });
    if (!res.ok) return "PENDING";
    const data = (await res.json()) as { status: string };
    const map: Record<string, PaymentState> = {
      created: "INITIATED",
      authorized: "AUTHORIZED",
      captured: "CAPTURED",
      failed: "FAILED",
      refunded: "REFUNDED",
    };
    return map[data.status] ?? "PENDING";
  }
}

/**
 * Asks Razorpay whether a key pair is valid (a harmless read of the latest
 * order). "invalid" = Razorpay rejected them; "unreachable" = no internet or
 * Razorpay down, so we can't tell yet.
 */
export async function checkRazorpayCredentials(
  credentials: Pick<RazorpayCredentials, "keyId" | "keySecret">,
  fetchImpl: typeof fetch = fetch,
): Promise<"valid" | "invalid" | "unreachable"> {
  try {
    const token = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64");
    const res = await fetchImpl(`${RAZORPAY_API_BASE}/orders?count=1`, {
      headers: { Authorization: `Basic ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return "valid";
    if (res.status === 401 || res.status === 403) return "invalid";
    logger.warn(`Razorpay key check got an unexpected HTTP ${res.status}`);
    return "unreachable";
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause?.code;
    logger.warn(`Couldn't reach Razorpay to check keys: ${(err as Error).name} ${(err as Error).message}${cause ? ` (${cause})` : ""}`);
    return "unreachable";
  }
}

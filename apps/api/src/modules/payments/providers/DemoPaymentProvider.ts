import type {
  CreateProviderOrderParams,
  CreateProviderOrderResult,
  PaymentProvider,
  RefundPaymentParams,
  RefundPaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "./PaymentProvider.js";
import { generateDemoOrderId } from "../../../utils/ids.js";
import type { PaymentState } from "@saffra/types";

// In-memory ledger of demo payment states, keyed by providerPaymentId. This
// lets /payments/demo/process (which simulates the user's checkout choice)
// and /payments/verify (the shared verification endpoint) agree on outcome
// without needing a separate table — the Payment row in Postgres remains the
// durable source of truth; this is just a same-process handoff.
const demoOutcomes = new Map<string, VerifyPaymentResult>();

export class DemoPaymentProvider implements PaymentProvider {
  readonly kind = "DEMO" as const;

  async createOrder(params: CreateProviderOrderParams): Promise<CreateProviderOrderResult> {
    return {
      providerOrderId: generateDemoOrderId(),
      amount: params.amountRupees,
      currency: params.currency,
      // no keyId — Demo checkout never loads a real checkout.js
    };
  }

  /** Called by the Demo checkout UI when the user picks a method + outcome. */
  recordSimulatedOutcome(
    providerPaymentId: string,
    outcome: "success" | "failure" | "pending",
    method: VerifyPaymentParams["method"],
  ): void {
    const state: PaymentState =
      outcome === "success" ? "CAPTURED" : outcome === "pending" ? "AUTHORIZED" : "FAILED";
    demoOutcomes.set(providerPaymentId, {
      valid: outcome !== "failure",
      state,
      failureReason: outcome === "failure" ? "Card declined by issuing bank (simulated)" : undefined,
    });
    void method;
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const recorded = demoOutcomes.get(params.providerPaymentId);
    if (recorded) return recorded;
    // Fallback: no simulated outcome recorded yet — treat as still pending.
    return { valid: false, state: "PENDING" };
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    return { refundId: `rfnd_demo_${params.providerPaymentId.slice(-8)}`, state: "REFUNDED" };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentState> {
    return demoOutcomes.get(providerPaymentId)?.state ?? "PENDING";
  }
}

export const demoPaymentProvider = new DemoPaymentProvider();

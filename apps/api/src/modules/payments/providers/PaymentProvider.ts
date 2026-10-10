import type { PaymentMethod, PaymentProviderKind, PaymentState } from "@saffra/types";

export interface CreateProviderOrderParams {
  amountRupees: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateProviderOrderResult {
  providerOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

export interface VerifyPaymentParams {
  providerOrderId: string;
  providerPaymentId: string;
  signature?: string;
  method?: PaymentMethod;
}

export interface VerifyPaymentResult {
  valid: boolean;
  state: PaymentState;
  failureReason?: string;
}

export interface RefundPaymentParams {
  providerPaymentId: string;
  amountRupees: number;
}

export interface RefundPaymentResult {
  refundId: string;
  state: PaymentState;
}

/**
 * Every payment provider — Demo or Razorpay — implements this exact
 * contract. The frontend and the rest of the backend only ever talk to a
 * `PaymentProvider`, never to a concrete implementation, so switching
 * providers is a pure configuration decision (see providers/index.ts).
 */
export interface PaymentProvider {
  readonly kind: PaymentProviderKind;
  /** Public key handed to the browser checkout (Razorpay key id). Never a secret. */
  readonly publicKeyId?: string;
  createOrder(params: CreateProviderOrderParams): Promise<CreateProviderOrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;
  getStatus(providerPaymentId: string): Promise<PaymentState>;
}

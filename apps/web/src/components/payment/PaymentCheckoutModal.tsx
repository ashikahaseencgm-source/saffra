import { useEffect, useMemo, useState } from "react";
import {
  Smartphone,
  CreditCard,
  Landmark,
  Wallet,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
  Download,
} from "lucide-react";
import { Modal, Button, toast } from "@saffra/ui";
import type { PaymentCreateResponseDTO, PaymentMethod } from "@saffra/types";
import { paymentsApi } from "../../api/payments.js";
import { receiptsApi } from "../../api/receipts.js";
import { openRazorpayCheckout } from "../../lib/razorpayLoader.js";
import { FakeQr } from "./FakeQr.js";
import { ApiError } from "../../api/client.js";

type Step = "loading" | "select-method" | "method-detail" | "processing" | "success" | "failure" | "pending";

const METHODS: { id: PaymentMethod; label: string; icon: typeof Smartphone }[] = [
  { id: "UPI", label: "UPI", icon: Smartphone },
  { id: "CREDIT_CARD", label: "Credit Card", icon: CreditCard },
  { id: "DEBIT_CARD", label: "Debit Card", icon: CreditCard },
  { id: "NET_BANKING", label: "Net Banking", icon: Landmark },
  { id: "WALLET", label: "Wallet", icon: Wallet },
  { id: "QR", label: "Scan QR", icon: QrCode },
];

export interface PaymentEndpoints {
  create: () => Promise<PaymentCreateResponseDTO>;
  demoProcess: (
    paymentId: string,
    method: PaymentMethod,
    outcome: "success" | "failure" | "pending",
  ) => Promise<{ state: string; providerPaymentId: string; receiptId: string | null }>;
  verify: (data: {
    paymentId: string;
    providerOrderId: string;
    providerPaymentId: string;
    signature?: string;
    method?: PaymentMethod;
  }) => Promise<{ verified: boolean; state: string; receiptId: string | null }>;
}

export function PaymentCheckoutModal({
  open,
  orderId,
  amount,
  onClose,
  onSuccess,
  endpoints,
  downloadReceipt,
}: {
  open: boolean;
  orderId: string;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
  /** Defaults to the staff-authenticated payments API. Pass a token-scoped
   * set (see api/publicPay.ts) to reuse this exact checkout UI on the
   * unauthenticated customer-facing pay page. */
  endpoints?: PaymentEndpoints;
  /** Defaults to the staff-authenticated receipt PDF endpoint. Pass a
   * token-scoped fetcher (see api/publicPay.ts) on the public pay page. */
  downloadReceipt?: () => Promise<Blob>;
}) {
  const api = useMemo<PaymentEndpoints>(
    () =>
      endpoints ?? {
        create: () => paymentsApi.create(orderId),
        demoProcess: paymentsApi.demoProcess,
        verify: paymentsApi.verify,
      },
    [endpoints, orderId],
  );
  const fetchReceiptPdf = downloadReceipt ?? (() => receiptsApi.pdfBlob(orderId));
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [step, setStep] = useState<Step>("loading");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [providerOrderId, setProviderOrderId] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [txnId, setTxnId] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [keyId, setKeyId] = useState<string | undefined>(undefined);
  const [restaurantName, setRestaurantName] = useState("Saffra Bistro");
  // Snapshotted once from the create-payment response, so the modal keeps
  // showing the correct figure even if the parent's order/queue list
  // refetches and re-renders with a different `amount` prop mid-flow (e.g.
  // the order leaves the "awaiting payment" queue the instant it's paid).
  const [displayAmount, setDisplayAmount] = useState(amount);

  useEffect(() => {
    if (!open) return;
    setStep("loading");
    setMethod(null);
    setFailureReason(null);
    setDisplayAmount(amount);
    api
      .create()
      .then((res) => {
        setPaymentId(res.paymentId);
        setProviderOrderId(res.providerOrderId);
        setIsDemo(res.provider === "DEMO");
        setKeyId(res.keyId);
        setRestaurantName(res.restaurantName);
        setDisplayAmount(res.amount);
        setStep("select-method");
      })
      .catch((err) => {
        toast.error("Could not start payment", err instanceof ApiError ? err.message : undefined);
        onClose();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId, api]);

  function selectMethod(m: PaymentMethod) {
    setMethod(m);
    if (!isDemo) {
      void launchRazorpay(m);
    } else {
      setStep("method-detail");
    }
  }

  async function launchRazorpay(m: PaymentMethod) {
    if (!paymentId || !providerOrderId || !keyId) return;
    setStep("processing");
    const opened = await openRazorpayCheckout({
      key: keyId,
      amount: Math.round(displayAmount * 100),
      currency: "INR",
      name: restaurantName,
      description: `Order payment`,
      order_id: providerOrderId,
      theme: { color: "#13302A" },
      handler: (response) => {
        void finalizeRazorpay(response, m);
      },
      modal: { ondismiss: () => setStep("select-method") },
    });
    if (!opened) {
      toast.error("Razorpay checkout could not be loaded", "Falling back to demo checkout.");
      setStep("select-method");
    }
  }

  async function finalizeRazorpay(
    response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
    m: PaymentMethod,
  ) {
    if (!paymentId) return;
    try {
      const result = await api.verify({
        paymentId,
        providerOrderId: response.razorpay_order_id,
        providerPaymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature,
        method: m,
      });
      setTxnId(response.razorpay_payment_id);
      if (result.verified && result.receiptId) {
        setStep("success");
      } else {
        setFailureReason("Payment could not be verified");
        setStep("failure");
      }
    } catch (err) {
      setFailureReason(err instanceof ApiError ? err.message : "Verification failed");
      setStep("failure");
    }
  }

  async function simulate(outcome: "success" | "failure" | "pending") {
    if (!paymentId || !method) return;
    setStep("processing");
    await new Promise((r) => setTimeout(r, 1100));
    try {
      const result = await api.demoProcess(paymentId, method, outcome);
      setTxnId(result.providerPaymentId);
      if (outcome === "success" && result.receiptId) {
        setStep("success");
      } else if (outcome === "pending") {
        setStep("pending");
      } else {
        setFailureReason("Card declined by issuing bank (simulated)");
        setStep("failure");
      }
    } catch (err) {
      setFailureReason(err instanceof ApiError ? err.message : "Something went wrong");
      setStep("failure");
    }
  }

  async function handleDownloadReceipt() {
    setDownloadingReceipt(true);
    try {
      const blob = await fetchReceiptPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't download the receipt");
    } finally {
      setDownloadingReceipt(false);
    }
  }

  function handleClose() {
    if (step === "success") {
      // handled via onSuccess already
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Proceed to Payment" size="md">
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-xl bg-bg px-4 py-3">
          <span className="text-sm text-muted">Amount payable</span>
          <span className="font-display text-xl font-bold text-primary">₹{displayAmount.toLocaleString("en-IN")}</span>
        </div>

        {isDemo && (
          <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs font-semibold text-accent">
            <ShieldCheck className="h-3.5 w-3.5" />
            Demo Payment Environment — no real transaction will occur
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-7 w-7 animate-spin text-secondary" />
            <p className="text-sm text-muted">Preparing secure checkout…</p>
          </div>
        )}

        {step === "select-method" && (
          <div className="grid grid-cols-2 gap-3">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => selectMethod(m.id)}
                className="flex flex-col items-center gap-2 rounded-xl border border-borderc bg-white py-4 transition-all hover:-translate-y-0.5 hover:border-secondary hover:shadow-elevated"
              >
                <m.icon className="h-6 w-6 text-secondary" />
                <span className="text-sm font-medium text-primary">{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === "method-detail" && method && (
          <MethodDetail method={method} paymentId={paymentId} onBack={() => setStep("select-method")} onSimulate={simulate} />
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-secondary" />
            <p className="text-sm font-medium text-primary">Processing your payment…</p>
            <p className="text-xs text-muted">Please don't close this window</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-8 animate-slide-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <p className="font-display text-lg font-bold text-primary">Payment Successful</p>
            <p className="text-xs text-muted">Txn ID: {txnId}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" loading={downloadingReceipt} onClick={handleDownloadReceipt}>
                <Download className="h-4 w-4" /> Download Receipt
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  onSuccess();
                }}
              >
                View Receipt
              </Button>
            </div>
          </div>
        )}

        {step === "failure" && (
          <div className="flex flex-col items-center gap-3 py-8 animate-slide-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
              <XCircle className="h-9 w-9 text-danger" />
            </div>
            <p className="font-display text-lg font-bold text-primary">Payment Failed</p>
            <p className="text-xs text-muted">{failureReason}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep("select-method")}>Retry</Button>
            </div>
          </div>
        )}

        {step === "pending" && (
          <div className="flex flex-col items-center gap-3 py-8 animate-slide-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <Clock className="h-9 w-9 text-warning" />
            </div>
            <p className="font-display text-lg font-bold text-primary">Payment Pending</p>
            <p className="text-xs text-muted">Awaiting confirmation from the payment provider (simulated).</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={() => setStep("select-method")}>Retry</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MethodDetail({
  method,
  paymentId,
  onBack,
  onSimulate,
}: {
  method: PaymentMethod;
  paymentId: string | null;
  onBack: () => void;
  onSimulate: (outcome: "success" | "failure" | "pending") => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Choose a different method
      </button>

      {(method === "UPI" || method === "QR") && (
        <div className="flex flex-col items-center gap-2">
          <FakeQr seed={paymentId ?? "saffra"} />
          <p className="text-xs text-muted">Scan with any UPI app to pay</p>
        </div>
      )}

      {(method === "CREDIT_CARD" || method === "DEBIT_CARD") && (
        <div className="space-y-3 rounded-xl border border-borderc bg-bg p-4">
          <div className="rounded-lg border border-borderc bg-white px-3 py-2.5 text-sm text-muted">4242 4242 4242 4242</div>
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg border border-borderc bg-white px-3 py-2.5 text-sm text-muted">MM / YY</div>
            <div className="flex-1 rounded-lg border border-borderc bg-white px-3 py-2.5 text-sm text-muted">CVV</div>
          </div>
        </div>
      )}

      {method === "NET_BANKING" && (
        <div className="space-y-2 rounded-xl border border-borderc bg-bg p-4">
          {["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank"].map((bank) => (
            <div key={bank} className="rounded-lg border border-borderc bg-white px-3 py-2.5 text-sm text-primary">
              {bank}
            </div>
          ))}
        </div>
      )}

      {method === "WALLET" && (
        <div className="grid grid-cols-2 gap-2">
          {["Paytm", "PhonePe", "Amazon Pay", "Mobikwik"].map((wallet) => (
            <div key={wallet} className="rounded-lg border border-borderc bg-white px-3 py-2.5 text-center text-sm text-primary">
              {wallet}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-borderc p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Demo controls</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="success" onClick={() => onSimulate("success")}>
            Simulate Success
          </Button>
          <Button size="sm" variant="danger" onClick={() => onSimulate("failure")}>
            Simulate Failure
          </Button>
          <Button size="sm" variant="outline" onClick={() => onSimulate("pending")}>
            Simulate Pending
          </Button>
        </div>
      </div>
    </div>
  );
}

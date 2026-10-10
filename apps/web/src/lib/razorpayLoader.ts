// Dynamically injects the real Razorpay checkout.js — but ONLY when the
// backend reports Razorpay is actually configured (settingsApi.get() ->
// payment.provider !== 'DEMO'). Until then this script is never loaded and
// the app renders the in-app Demo Checkout instead. Once real
// RAZORPAY_KEY_ID/SECRET env vars are added server-side, the exact same
// "Proceed to Payment" button starts opening the real Razorpay Standard
// Checkout — no frontend redeploy or code branch needed here beyond this
// loader already being wired in.

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && (window as any).Razorpay) {
    return Promise.resolve(true);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return loadPromise;
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number; // paise
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<boolean> {
  const loaded = await loadRazorpayScript();
  if (!loaded || !(window as any).Razorpay) return false;
  const rzp = new (window as any).Razorpay(options);
  rzp.open();
  return true;
}

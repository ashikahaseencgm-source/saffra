import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Receipt, Download } from "lucide-react";
import { Button, toast } from "@saffra/ui";
import { publicPayApi } from "../api/publicPay.js";
import { PaymentCheckoutModal } from "../components/payment/PaymentCheckoutModal.js";
import logoIcon from "../assets/logo.png";

export function PayPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [payOpen, setPayOpen] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  async function handleDownloadReceipt() {
    if (!token) return;
    setDownloadingReceipt(true);
    try {
      const blob = await publicPayApi.downloadReceiptPdf(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "receipt.pdf";
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

  const { data: summary, isLoading, error, refetch } = useQuery({
    queryKey: ["public-pay", token],
    queryFn: () => publicPayApi.getSummary(token!),
    enabled: !!token,
    retry: false,
  });

  const endpoints = useMemo(() => (token ? publicPayApi.forToken(token) : null), [token]);

  if (isLoading) {
    return (
      <PublicShell>
        <p className="text-center text-sm text-muted">Loading your bill…</p>
      </PublicShell>
    );
  }

  if (error || !summary) {
    return (
      <PublicShell>
        <p className="text-center text-sm font-medium text-danger">
          This payment link is invalid or has expired. Please ask your server for a new one.
        </p>
      </PublicShell>
    );
  }

  const paid = summary.alreadyPaid || justPaid;

  return (
    <PublicShell restaurantName={summary.restaurantName}>
      {paid ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-9 w-9 text-success" />
          </div>
          <p className="font-display text-lg font-bold text-primary">Payment Complete</p>
          <p className="text-sm text-muted">Thank you for dining with {summary.restaurantName}!</p>
          <Button variant="outline" className="mt-2" loading={downloadingReceipt} onClick={handleDownloadReceipt}>
            <Download className="h-4 w-4" /> Download Receipt
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{summary.tableLabel}</p>
              <p className="font-display text-sm font-bold text-primary">{summary.orderNumber}</p>
            </div>
            <Receipt className="h-6 w-6 text-borderc" />
          </div>

          <div className="mb-4 divide-y divide-borderc/70 rounded-xl border border-borderc">
            {summary.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                <span className="text-primary">
                  {item.quantity} × {item.name}
                </span>
                <span className="font-medium text-primary">₹{item.total.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 rounded-xl bg-bg p-3.5 text-sm">
            <BillRow label="Subtotal" value={summary.bill.subtotal} />
            {summary.bill.discountAmount > 0 && <BillRow label="Discount" value={-summary.bill.discountAmount} />}
            <BillRow label="GST" value={summary.bill.cgst + summary.bill.sgst} />
            <BillRow label="Service Charge" value={summary.bill.serviceCharge} />
            <div className="mt-1 flex items-center justify-between border-t border-borderc pt-1.5">
              <span className="font-display text-sm font-bold text-primary">Total</span>
              <span className="font-display text-lg font-bold text-primary">₹{summary.bill.grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <Button fullWidth size="lg" className="mt-5" onClick={() => setPayOpen(true)}>
            Pay ₹{summary.bill.grandTotal.toLocaleString("en-IN")}
          </Button>
        </>
      )}

      {endpoints && (
        <PaymentCheckoutModal
          open={payOpen}
          orderId={token!}
          amount={summary.bill.grandTotal}
          endpoints={endpoints}
          downloadReceipt={() => publicPayApi.downloadReceiptPdf(token!)}
          onClose={() => setPayOpen(false)}
          onSuccess={() => {
            setPayOpen(false);
            setJustPaid(true);
            void refetch();
          }}
        />
      )}
    </PublicShell>
  );
}

function BillRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-primary">
        {value < 0 ? "-" : ""}₹{Math.abs(value).toLocaleString("en-IN")}
      </span>
    </div>
  );
}

function PublicShell({ children, restaurantName }: { children: React.ReactNode; restaurantName?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <img src={logoIcon} alt="" className="mb-2 h-10 w-10 rounded-xl" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{restaurantName ?? "Saffra"}</p>
        </div>
        <div className="rounded-card border border-borderc bg-white p-5 shadow-elevated">{children}</div>
        <p className="mt-4 text-center text-[11px] text-muted">Secured checkout powered by Saffra</p>
      </div>
    </div>
  );
}

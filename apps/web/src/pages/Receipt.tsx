import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Download, Mail, CheckCircle2 } from "lucide-react";
import { Button, toast } from "@saffra/ui";
import { ordersApi } from "../api/orders.js";
import { receiptsApi } from "../api/receipts.js";
import { LoyaltyEarnedNote } from "../components/loyalty/LoyaltyEarnedNote.js";

export function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: order } = useQuery({ queryKey: ["orders", orderId], queryFn: () => ordersApi.get(orderId!), enabled: !!orderId });
  const { data: html, isLoading } = useQuery({ queryKey: ["receipt", orderId], queryFn: () => receiptsApi.html(orderId!), enabled: !!orderId });

  useEffect(() => {
    if (orderId) void receiptsApi.reprint(orderId).catch(() => undefined);
  }, [orderId]);

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  async function handleDownload() {
    if (!orderId) return;
    setDownloading(true);
    try {
      const blob = await receiptsApi.pdfBlob(orderId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${order?.orderNumber ?? "receipt"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't download receipt");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <button onClick={() => navigate(-1)} className="mb-5 flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col items-center">
          <div className="mb-4 flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Order Completed
          </div>

          <div className="w-[340px] overflow-hidden rounded-2xl border border-borderc bg-white shadow-elevated">
            {isLoading ? (
              <div className="p-10 text-center text-sm text-muted">Generating receipt…</div>
            ) : (
              <iframe ref={iframeRef} srcDoc={html} title="Receipt" className="h-[560px] w-full border-0" />
            )}
          </div>
        </div>

        <div className="w-full max-w-xs space-y-3 lg:sticky lg:top-8">
          {orderId && <LoyaltyEarnedNote orderId={orderId} />}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Receipt Actions</p>
          <Button fullWidth onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button fullWidth variant="secondary" loading={downloading} onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <div className="group relative">
            <Button fullWidth variant="outline" disabled>
              <Mail className="h-4 w-4" /> Email Receipt
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-muted">Email delivery is coming soon.</p>
          </div>

          {order && (
            <div className="mt-4 rounded-xl border border-borderc bg-bg p-4 text-sm">
              <p className="font-semibold text-primary">{order.orderNumber}</p>
              <p className="mt-1 text-xs text-muted">
                {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType.replace("_", " ")} · {order.waiterName}
              </p>
              <p className="mt-2 font-display text-lg font-bold text-primary">₹{order.bill.grandTotal.toLocaleString("en-IN")}</p>
            </div>
          )}

          <Button fullWidth variant="ghost" onClick={() => navigate("/tables")}>
            Back to Tables
          </Button>
        </div>
      </div>
    </div>
  );
}

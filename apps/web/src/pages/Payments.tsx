import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Banknote, Receipt as ReceiptIcon, Link2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Modal, Input, EmptyState, toast } from "@saffra/ui";
import type { OrderDTO } from "@saffra/types";
import { ordersApi } from "../api/orders.js";
import { paymentsApi } from "../api/payments.js";
import { settingsApi } from "../api/settings.js";
import { PageHeader } from "../components/PageHeader.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { PaymentCheckoutModal } from "../components/payment/PaymentCheckoutModal.js";
import { WhatsAppSendModal } from "../components/customer/WhatsAppSendModal.js";
import { ApiError } from "../api/client.js";

export function PaymentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [cashOrderId, setCashOrderId] = useState<string | null>(null);
  const [linkOrder, setLinkOrder] = useState<OrderDTO | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });

  const createLink = useMutation({
    mutationFn: (order: OrderDTO) => ordersApi.createPaymentLink(order.id).then((res) => ({ order, token: res.token })),
    onSuccess: ({ order, token }) => {
      setLinkOrder(order);
      setLinkUrl(`${window.location.origin}/pay/${token}`);
    },
    onError: (err) => toast.error("Couldn't create payment link", err instanceof ApiError ? err.message : undefined),
  });

  // "Billable" covers everything from CONFIRMED through PAYMENT_PENDING —
  // a cashier can bill a table on request even before the kitchen has
  // marked it served, not just once it's SERVED.
  const { data: billableOrders, isLoading } = useQuery({
    queryKey: ["orders", "billable"],
    queryFn: () => ordersApi.list({ billable: true, pageSize: 50 }),
    refetchInterval: 8000,
  });
  const { data: paidOrders } = useQuery({
    queryKey: ["orders", "recently-paid"],
    queryFn: () => ordersApi.list({ status: "PAID", pageSize: 10 }),
    refetchInterval: 15000,
  });

  const queue = billableOrders?.data ?? [];

  return (
    <div data-tour-target="payments" className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader eyebrow="Billing" title="Payments" description="Collect payments for served orders and reprint receipts." />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Awaiting Payment ({queue.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted">Loading…</p>
            ) : queue.length === 0 ? (
              <EmptyState title="All caught up" description="No orders are waiting for payment right now." />
            ) : (
              <div className="space-y-3">
                {queue.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-borderc p-3.5">
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType.replace("_", " ")}
                        {order.customerName && <span className="text-secondary"> · {order.customerName}</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {order.orderNumber} · {order.waiterName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-display text-sm font-bold text-primary">₹{order.bill.grandTotal.toLocaleString("en-IN")}</p>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" loading={createLink.isPending && createLink.variables?.id === order.id} onClick={() => createLink.mutate(order)}>
                          <Link2 className="h-3.5 w-3.5" /> Link
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCashOrderId(order.id)}>
                          <Banknote className="h-3.5 w-3.5" /> Cash
                        </Button>
                        <Button size="sm" onClick={() => setCheckoutOrderId(order.id)}>
                          <Wallet className="h-3.5 w-3.5" /> Collect
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently Paid</CardTitle>
          </CardHeader>
          <CardContent>
            {paidOrders?.data.length ? (
              <div className="space-y-3">
                {paidOrders.data.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-xl border border-borderc/70 p-3">
                    <div>
                      <p className="text-sm font-semibold text-primary">{order.orderNumber}</p>
                      <p className="text-xs text-muted">
                        {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType.replace("_", " ")} · ₹
                        {order.bill.grandTotal.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/orders/${order.id}/receipt`)}
                      className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
                    >
                      <ReceiptIcon className="h-3.5 w-3.5" /> Reprint
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No payments yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {checkoutOrderId && (
        <PaymentCheckoutModal
          open={!!checkoutOrderId}
          orderId={checkoutOrderId}
          amount={queue.find((o) => o.id === checkoutOrderId)?.bill.grandTotal ?? 0}
          onClose={() => setCheckoutOrderId(null)}
          onSuccess={() => {
            const id = checkoutOrderId;
            setCheckoutOrderId(null);
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            if (id) navigate(`/orders/${id}/receipt`);
          }}
        />
      )}

      <Modal open={!!cashOrderId} onClose={() => setCashOrderId(null)} title="Cash Payment" size="sm">
        {cashOrderId && (
          <CashPaymentForm
            orderId={cashOrderId}
            amountDue={queue.find((o) => o.id === cashOrderId)?.bill.grandTotal ?? 0}
            onDone={(id) => {
              setCashOrderId(null);
              queryClient.invalidateQueries({ queryKey: ["orders"] });
              navigate(`/orders/${id}/receipt`);
            }}
          />
        )}
      </Modal>

      {linkOrder && linkUrl && (
        <WhatsAppSendModal
          open={!!linkOrder}
          onClose={() => {
            setLinkOrder(null);
            setLinkUrl(null);
          }}
          link={linkUrl}
          defaultPhone={linkOrder.customerPhone ?? ""}
          customerName={linkOrder.customerName ?? "Guest"}
          restaurantName={settings?.restaurant.name ?? "Saffra Bistro"}
          amount={linkOrder.bill.grandTotal}
        />
      )}
    </div>
  );
}

function CashPaymentForm({ orderId, amountDue, onDone }: { orderId: string; amountDue: number; onDone: (orderId: string) => void }) {
  const [amountReceived, setAmountReceived] = useState(String(amountDue));
  const change = Math.max(0, Number(amountReceived || 0) - amountDue);

  const mutation = useMutation({
    mutationFn: () => paymentsApi.cash(orderId, Number(amountReceived)),
    onSuccess: () => {
      toast.success("Cash payment recorded");
      onDone(orderId);
    },
    onError: (err) => toast.error("Couldn't record payment", err instanceof ApiError ? err.message : undefined),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-bg px-4 py-3">
        <span className="text-sm text-muted">Amount payable</span>
        <span className="font-display text-lg font-bold text-primary">₹{amountDue.toLocaleString("en-IN")}</span>
      </div>
      <Input
        label="Amount received"
        type="number"
        min={amountDue}
        value={amountReceived}
        onChange={(e) => setAmountReceived(e.target.value)}
      />
      <div className="flex items-center justify-between rounded-xl border border-dashed border-borderc px-4 py-3">
        <span className="text-sm text-muted">Change to return</span>
        <span className="font-display text-lg font-bold text-success">₹{change.toLocaleString("en-IN")}</span>
      </div>
      <Button fullWidth loading={mutation.isPending} disabled={Number(amountReceived) < amountDue} onClick={() => mutation.mutate()}>
        Confirm Cash Payment
      </Button>
    </div>
  );
}

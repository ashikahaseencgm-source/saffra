import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  StickyNote,
  Send,
  CheckCircle2,
  UtensilsCrossed,
  Wallet,
  Percent,
  Leaf,
  Link2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Button, Input, Modal, Select, toast, cn } from "@saffra/ui";
import type { MenuItemDTO, OrderDTO } from "@saffra/types";
import { ordersApi } from "../api/orders.js";
import { menuApi } from "../api/menu.js";
import { paymentsApi } from "../api/payments.js";
import { settingsApi } from "../api/settings.js";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { ApiError } from "../api/client.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { PaymentCheckoutModal } from "../components/payment/PaymentCheckoutModal.js";
import { WhatsAppSendModal } from "../components/customer/WhatsAppSendModal.js";
import { useAuthStore } from "../store/authStore.js";
import { LoyaltyRedeemCard } from "../components/loyalty/LoyaltyRedeemCard.js";

/** Something that can be added to the cart: a menu item, or another of a line already on the order. */
type AddableItem = Pick<MenuItemDTO, "id" | "name" | "price"> & { notes?: string | null };

const DISCOUNT_REASONS = ["Loyal Customer", "Staff Discount", "Festival Offer", "Manager Approval"];

export function OrderWorkspacePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canDiscount = role === "MANAGER" || role === "ADMIN";

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });

  const orderQuery = useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => ordersApi.get(orderId!),
    enabled: !!orderId,
    refetchInterval: 6000,
  });
  const order = orderQuery.data;

  const categoriesQuery = useQuery({ queryKey: ["menu", "categories"], queryFn: menuApi.categories });
  const menuQuery = useQuery({
    queryKey: ["menu", "items", debouncedSearch, category],
    queryFn: () => menuApi.list({ q: debouncedSearch || undefined, category: category ?? undefined, available: true }),
  });

  const orderKey = ["orders", orderId] as const;
  const invalidateOrder = () => queryClient.invalidateQueries({ queryKey: orderKey });

  // Optimistic cart edits: the item list updates the instant you click, so
  // adding/adjusting/removing items feels immediate even though the actual
  // request (and the authoritative, server-recomputed bill) can take a
  // moment over the network. Any mismatch self-heals on settle, since we
  // always refetch the real order afterwards.
  async function withOptimisticOrder(updater: (current: OrderDTO) => OrderDTO) {
    await queryClient.cancelQueries({ queryKey: orderKey });
    const previous = queryClient.getQueryData<OrderDTO>(orderKey);
    if (previous) queryClient.setQueryData<OrderDTO>(orderKey, updater(previous));
    return previous;
  }

  const addItem = useMutation({
    mutationFn: (menuItem: AddableItem) =>
      ordersApi.addItem(orderId!, { menuItemId: menuItem.id, quantity: 1, notes: menuItem.notes ?? undefined }),
    onMutate: async (menuItem) => {
      return {
        previous: await withOptimisticOrder((current) => {
          // Mirrors the backend: only merge onto a line that hasn't gone to
          // the kitchen yet — anything already sent is locked, so more of it
          // becomes a new line that goes out as the next kitchen round.
          const existing = current.items.find(
            (i) => i.menuItemId === menuItem.id && (i.notes ?? "") === (menuItem.notes ?? "") && i.kitchenStatus === "PENDING",
          );
          const items = existing
            ? current.items.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i))
            : [
                ...current.items,
                {
                  id: `optimistic-${menuItem.id}-${Date.now()}`,
                  menuItemId: menuItem.id,
                  name: menuItem.name,
                  price: menuItem.price,
                  quantity: 1,
                  notes: menuItem.notes ?? null,
                  total: menuItem.price,
                  kitchenStatus: "PENDING" as const,
                },
              ];
          return { ...current, items };
        }),
      };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(orderKey, context.previous);
      toast.error("Couldn't add item", err instanceof ApiError ? err.message : undefined);
    },
    onSettled: () => invalidateOrder(),
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, quantity, notes }: { itemId: string; quantity?: number; notes?: string | null }) =>
      ordersApi.updateItem(orderId!, itemId, { quantity, notes }),
    onMutate: async ({ itemId, quantity, notes }) => {
      return {
        previous: await withOptimisticOrder((current) => ({
          ...current,
          items: current.items.map((i) =>
            i.id === itemId
              ? { ...i, quantity: quantity ?? i.quantity, notes: notes !== undefined ? notes : i.notes, total: (quantity ?? i.quantity) * i.price }
              : i,
          ),
        })),
      };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(orderKey, context.previous);
    },
    onSettled: () => invalidateOrder(),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => ordersApi.removeItem(orderId!, itemId),
    onMutate: async (itemId) => {
      return {
        previous: await withOptimisticOrder((current) => ({ ...current, items: current.items.filter((i) => i.id !== itemId) })),
      };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(orderKey, context.previous);
    },
    onSettled: () => invalidateOrder(),
  });

  const applyDiscount = useMutation({
    mutationFn: (data: { type: "PERCENTAGE" | "FLAT"; value: number; reason: string }) =>
      ordersApi.applyDiscount(orderId!, data),
    onSuccess: () => {
      invalidateOrder();
      setDiscountOpen(false);
      toast.success("Discount applied");
    },
    onError: (err) => toast.error("Couldn't apply discount", err instanceof ApiError ? err.message : undefined),
  });

  const lifecycleAction = useMutation({
    mutationFn: (action: "confirm" | "sendToKitchen" | "serve" | "complete") => ordersApi[action](orderId!),
    onSuccess: (updated) => {
      invalidateOrder();
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      if (updated.status === "COMPLETED") navigate("/tables");
    },
    onError: (err) => toast.error("Action failed", err instanceof ApiError ? err.message : undefined),
  });

  // Only reachable while the order is still a DRAFT — nothing has gone to
  // the kitchen yet, so cancelling here just frees the table back up.
  const cancelDraft = useMutation({
    mutationFn: () => ordersApi.cancel(orderId!, "Cancelled before confirming"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Order cancelled — table is free again");
      navigate("/tables");
    },
    onError: (err) => toast.error("Couldn't cancel order", err instanceof ApiError ? err.message : undefined),
  });

  const updateNote = useMutation({
    mutationFn: (note: string) => ordersApi.update(orderId!, { note }),
    onSuccess: () => {
      invalidateOrder();
      setNoteDraft(null);
    },
  });

  const createLink = useMutation({
    mutationFn: () => ordersApi.createPaymentLink(orderId!),
    onSuccess: (res) => {
      setLinkUrl(`${window.location.origin}/pay/${res.token}`);
      setLinkOpen(true);
    },
    onError: (err) => toast.error("Couldn't create payment link", err instanceof ApiError ? err.message : undefined),
  });

  // One table visit is one running bill — adding more food while payment is
  // still PENDING cancels that (uncharged) attempt and reopens this same
  // order, instead of forking a second order/second bill for the table.
  const reopenForMoreItems = useMutation({
    mutationFn: () => paymentsApi.cancelPendingForReorder(orderId!),
    onSuccess: () => {
      invalidateOrder();
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Reopened — add the extra items to the same bill");
    },
    onError: (err) => toast.error("Couldn't reopen the order", err instanceof ApiError ? err.message : undefined),
  });

  if (orderQuery.isLoading || !order) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">Loading order…</div>;
  }

  const cartQuantity = (menuItemId: string) =>
    order.items.filter((i) => i.menuItemId === menuItemId).reduce((s, i) => s + i.quantity, 0);

  // Items can be added/changed any time up through SERVED — customers often
  // order more after their first course. Mirrors ITEM_EDITABLE_STATUSES on
  // the backend, which is the actual source of truth (this just avoids a
  // round-trip to find out an edit will be rejected).
  const canEditItems = ["DRAFT", "CONFIRMED", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED"].includes(order.status);
  const canBill = ["CONFIRMED", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED"].includes(order.status) && order.bill.grandTotal > 0;
  // Nothing is ever fired to the kitchen just by being added to the cart —
  // it waits here, visibly, until the waiter explicitly sends it. DRAFT and
  // CONFIRMED already have their own "Confirm"/"Send to Kitchen" buttons
  // below for the very first round, so this banner only needs to cover a
  // later round added after the kitchen has already seen this order once.
  const pendingCount = order.items.filter((i) => i.kitchenStatus === "PENDING").reduce((s, i) => s + i.quantity, 0);
  const showSendPendingBanner = pendingCount > 0 && !["DRAFT", "CONFIRMED"].includes(order.status);
  // Mirrors PAYABLE_ORDER_STATUSES on the backend — a payment link can be
  // sent (or re-sent) any time the order is billable, including while a
  // staff-side checkout is already PAYMENT_PENDING.
  const canSendLink =
    ["CONFIRMED", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED", "PAYMENT_PENDING"].includes(order.status) &&
    order.bill.grandTotal > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-borderc bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/tables")} className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-primary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold text-primary">
                {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType.replace("_", " ")}
              </h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-muted">
              {order.orderNumber} · {order.waiterName}
              {order.customerName && (
                <>
                  {" · "}
                  <span className="font-medium text-secondary">{order.customerName}</span>
                  {order.customerPhone && ` (${order.customerPhone})`}
                </>
              )}
            </p>
          </div>
        </div>

        {canSendLink && (
          <Button variant="outline" size="sm" loading={createLink.isPending} onClick={() => createLink.mutate()}>
            <Link2 className="h-3.5 w-3.5" /> Send Payment Link
          </Button>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_1fr_380px]">
        {/* Category rail */}
        <div className="hidden overflow-y-auto border-r border-borderc bg-white p-3 lg:block">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              "mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
              category === null ? "bg-primary text-white" : "text-primary hover:bg-bg",
            )}
          >
            All Items
          </button>
          {categoriesQuery.data?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.name)}
              className={cn(
                "mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                category === cat.name ? "bg-primary text-white" : "text-primary hover:bg-bg",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu grid */}
        <div className="overflow-y-auto p-5">
          <Input
            icon={<Search className="h-4 w-4" />}
            placeholder="Search menu by name, category, keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {menuQuery.data?.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                quantity={cartQuantity(item.id)}
                disabled={!canEditItems}
                onAdd={() => addItem.mutate(item)}
              />
            ))}
          </div>
          {menuQuery.data?.length === 0 && <p className="py-10 text-center text-sm text-muted">No items match your search.</p>}
        </div>

        {/* Cart */}
        <div className="flex flex-col border-l border-borderc bg-white">
          <div className="relative border-b border-borderc bg-primary px-5 py-4 text-white">
            <div className="absolute inset-x-0 -bottom-2 flex justify-between px-1">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className="h-4 w-4 rounded-full bg-bg" />
              ))}
            </div>
            <p className="font-display text-sm font-semibold tracking-wide">Live Order</p>
            <p className="text-xs text-white/60">{order.items.length} item{order.items.length === 1 ? "" : "s"}</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-4 pt-5 scrollbar-thin">
            {order.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <UtensilsCrossed className="h-8 w-8 text-borderc" />
                <p className="text-sm text-muted">Cart is empty. Add items from the menu.</p>
              </div>
            )}
            {order.items.map((item) => {
              const served = item.kitchenStatus === "SERVED";
              const sent = item.kitchenStatus !== "PENDING";
              return (
              <div key={item.id} className="rounded-xl border border-borderc/80 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-primary">{item.name}</p>
                      {served ? (
                        <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success">
                          Served
                        </span>
                      ) : sent ? (
                        <span className="shrink-0 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                          In kitchen
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-secondary/10 px-1.5 py-0.5 text-[10px] font-bold text-secondary">
                          Not sent yet
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">₹{item.price} each</p>
                  </div>
                  {canEditItems && !sent && (
                    <button onClick={() => removeItem.mutate(item.id)} aria-label={`Remove ${item.name}`} className="text-muted hover:text-danger">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {item.notes && (
                  <p className="mt-1.5 flex items-center gap-1 rounded-lg bg-bg px-2 py-1 text-[11px] text-muted">
                    <StickyNote className="h-3 w-3" /> {item.notes}
                  </p>
                )}

                {sent && canEditItems && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    {served ? "Already served" : "Already with the kitchen"} — can't be changed. Tap + to order more.
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between">
                  {canEditItems ? (
                    <div className="flex items-center gap-2 rounded-lg border border-borderc">
                      <button
                        className="p-1.5 text-muted hover:text-primary disabled:opacity-40"
                        aria-label={`One less ${item.name}`}
                        disabled={item.quantity <= 1 || sent}
                        onClick={() => updateItem.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold text-primary">{item.quantity}</span>
                      <button
                        className="p-1.5 text-muted hover:text-primary"
                        aria-label={`One more ${item.name}`}
                        onClick={() =>
                          sent
                            ? addItem.mutate({ id: item.menuItemId, name: item.name, price: item.price, notes: item.notes })
                            : updateItem.mutate({ itemId: item.id, quantity: item.quantity + 1 })
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-primary">Qty {item.quantity}</span>
                  )}
                  <span className="font-display text-sm font-bold text-primary">₹{item.total.toLocaleString("en-IN")}</span>
                </div>

                {canEditItems && !sent && (
                  <NoteEditor
                    value={item.notes ?? ""}
                    onSave={(notes) => updateItem.mutate({ itemId: item.id, notes: notes || null })}
                  />
                )}
              </div>
              );
            })}

            {canEditItems && (
              <div>
                {noteDraft === null ? (
                  <button
                    onClick={() => setNoteDraft(order.note ?? "")}
                    className="flex w-full items-center gap-2 rounded-xl border border-dashed border-borderc px-3 py-2.5 text-xs font-medium text-muted hover:border-secondary hover:text-secondary"
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    {order.note ? "Edit order note" : "Add order note"}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="e.g. Customer requested quick service."
                      className="w-full rounded-xl border border-borderc p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateNote.mutate(noteDraft)}>
                        Save note
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setNoteDraft(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-borderc px-5 py-4">
            <BillRow label="Subtotal" value={order.bill.subtotal} />
            {order.bill.discountAmount - order.bill.loyaltyDiscount > 0 && (
              <BillRow
                label={`Discount${order.bill.discountReason ? ` (${order.bill.discountReason})` : ""}`}
                value={-(order.bill.discountAmount - order.bill.loyaltyDiscount)}
                accent="text-success"
              />
            )}
            {order.bill.loyaltyDiscount > 0 && (
              <BillRow label={`Paid with ${order.bill.loyaltyPointsRedeemed} points`} value={-order.bill.loyaltyDiscount} accent="text-success" />
            )}
            <BillRow label="CGST" value={order.bill.cgst} />
            <BillRow label="SGST" value={order.bill.sgst} />
            <BillRow label="Service Charge" value={order.bill.serviceCharge} />
            {order.bill.roundOff !== 0 && <BillRow label="Round Off" value={order.bill.roundOff} />}
            <div className="flex items-center justify-between border-t border-borderc pt-2">
              <span className="font-display text-sm font-bold text-primary">Grand Total</span>
              <span className="font-display text-lg font-bold text-primary">₹{order.bill.grandTotal.toLocaleString("en-IN")}</span>
            </div>

            {order.customerId && <LoyaltyRedeemCard order={order} />}

            {canDiscount && canEditItems && order.items.length > 0 && (
              <button
                onClick={() => setDiscountOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline"
              >
                <Percent className="h-3.5 w-3.5" /> Apply discount
              </button>
            )}

            {showSendPendingBanner && (
              <button
                onClick={() => lifecycleAction.mutate("sendToKitchen")}
                disabled={lifecycleAction.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
              >
                {lifecycleAction.isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send {pendingCount} new item{pendingCount > 1 ? "s" : ""} to Kitchen
              </button>
            )}

            <WorkflowActions
              order={order}
              onAction={(a) => lifecycleAction.mutate(a)}
              onPay={() => setPayOpen(true)}
              onReopenForMoreItems={() => reopenForMoreItems.mutate()}
              onCancelDraft={() => cancelDraft.mutate()}
              reopening={reopenForMoreItems.isPending}
              cancelling={cancelDraft.isPending}
              loading={lifecycleAction.isPending}
            />

            {canBill && order.status !== "SERVED" && order.status !== "PAYMENT_PENDING" && (
              <button
                onClick={() => setPayOpen(true)}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-secondary/40 py-2 text-xs font-semibold text-secondary hover:bg-secondary/5"
              >
                <Wallet className="h-3.5 w-3.5" /> Bill customer now (before serving)
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal open={discountOpen} onClose={() => setDiscountOpen(false)} title="Apply Discount" size="sm">
        <DiscountForm onSubmit={(data) => applyDiscount.mutate(data)} loading={applyDiscount.isPending} />
      </Modal>

      {order && (
        <PaymentCheckoutModal
          open={payOpen}
          orderId={order.id}
          amount={order.bill.grandTotal}
          onClose={() => setPayOpen(false)}
          onSuccess={() => navigate(`/orders/${order.id}/receipt`)}
        />
      )}

      {order && linkUrl && (
        <WhatsAppSendModal
          open={linkOpen}
          onClose={() => {
            setLinkOpen(false);
            setLinkUrl(null);
          }}
          link={linkUrl}
          defaultPhone={order.customerPhone ?? ""}
          customerName={order.customerName ?? "Guest"}
          restaurantName={settings?.restaurant.name ?? "Saffra Bistro"}
          amount={order.bill.grandTotal}
        />
      )}
    </div>
  );
}

function MenuCard({
  item,
  quantity,
  disabled,
  onAdd,
}: {
  item: MenuItemDTO;
  quantity: number;
  disabled: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-borderc bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-elevated">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
            item.foodType === "VEG" ? "border-success" : "border-danger",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", item.foodType === "VEG" ? "bg-success" : "bg-danger")} />
        </span>
        {item.popular && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">Popular</span>}
      </div>
      <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-primary">{item.name}</p>
      <p className="line-clamp-2 text-xs text-muted">{item.description}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-primary">₹{item.price}</span>
        <button
          onClick={onAdd}
          disabled={disabled}
          className={cn(
            "flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-bold transition-colors disabled:opacity-40",
            quantity > 0 ? "bg-success text-white" : "bg-primary text-white hover:bg-primary/90",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          {quantity > 0 ? quantity : "Add"}
        </button>
      </div>
    </div>
  );
}

function NoteEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="mt-1.5 text-[11px] font-semibold text-secondary hover:underline">
        {value ? "Edit note" : "+ Add note"}
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-1.5">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. Less spicy, no onion"
        className="w-full rounded-lg border border-borderc px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-secondary/40"
      />
      <Button
        size="sm"
        onClick={() => {
          onSave(draft);
          setEditing(false);
        }}
      >
        Save
      </Button>
    </div>
  );
}

function BillRow({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn("font-medium text-primary", accent)}>
        {value < 0 ? "-" : ""}₹{Math.abs(value).toLocaleString("en-IN")}
      </span>
    </div>
  );
}

function WorkflowActions({
  order,
  onAction,
  onPay,
  onReopenForMoreItems,
  onCancelDraft,
  reopening,
  cancelling,
  loading,
}: {
  order: OrderDTO;
  onAction: (action: "confirm" | "sendToKitchen" | "serve" | "complete") => void;
  onPay: () => void;
  onReopenForMoreItems: () => void;
  onCancelDraft: () => void;
  reopening: boolean;
  cancelling: boolean;
  loading: boolean;
}) {
  const hasItems = order.items.length > 0;

  if (order.status === "DRAFT") {
    return (
      <div className="mt-3 space-y-2">
        <Button fullWidth size="lg" disabled={!hasItems || loading} onClick={() => onAction("confirm")}>
          <CheckCircle2 className="h-4 w-4" /> Confirm Order
        </Button>
        <Button
          fullWidth
          variant="outline"
          className="!border-danger/30 !text-danger hover:!bg-danger/5"
          loading={cancelling}
          onClick={onCancelDraft}
        >
          <XCircle className="h-4 w-4" /> Cancel Table
        </Button>
      </div>
    );
  }
  if (order.status === "CONFIRMED") {
    return (
      <Button fullWidth size="lg" className="mt-3" disabled={loading} onClick={() => onAction("sendToKitchen")}>
        <Send className="h-4 w-4" /> Send to Kitchen
      </Button>
    );
  }
  if (order.status === "SENT_TO_KITCHEN" || order.status === "PREPARING") {
    return (
      <div className="mt-3 rounded-xl bg-bg px-3 py-3 text-center text-xs font-medium text-muted">
        Kitchen is preparing this order — you'll be notified when it's ready.
      </div>
    );
  }
  if (order.status === "READY") {
    return (
      <Button fullWidth size="lg" className="mt-3" disabled={loading} onClick={() => onAction("serve")}>
        <Leaf className="h-4 w-4" /> Mark as Served
      </Button>
    );
  }
  if (order.status === "SERVED") {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-secondary/40 bg-secondary/5 px-3 py-2.5">
          <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
          <p className="text-xs text-secondary">
            <span className="font-semibold">More Order?</span> Customer can still ask for more — just add items above. It stays
            on this same bill, one final receipt.
          </p>
        </div>
        <Button fullWidth size="lg" variant="secondary" onClick={onPay}>
          <Wallet className="h-4 w-4" /> Proceed to Payment
        </Button>
      </div>
    );
  }
  if (order.status === "PAYMENT_PENDING") {
    return (
      <div className="mt-3 space-y-2">
        <Button fullWidth size="lg" variant="secondary" onClick={onPay}>
          <Wallet className="h-4 w-4" /> Resume Payment
        </Button>
        <Button fullWidth variant="outline" loading={reopening} onClick={onReopenForMoreItems}>
          <UserPlus className="h-4 w-4" /> Customer wants more? Add to this bill
        </Button>
        <p className="text-center text-[11px] text-muted">
          Cancels the pending payment attempt (nothing was charged) and reopens this same order — one bill for the table, not a second one.
        </p>
      </div>
    );
  }
  if (order.status === "PAID") {
    return (
      <Button fullWidth size="lg" variant="success" className="mt-3" disabled={loading} onClick={() => onAction("complete")}>
        <CheckCircle2 className="h-4 w-4" /> Complete Order
      </Button>
    );
  }
  return null;
}

function DiscountForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: { type: "PERCENTAGE" | "FLAT"; value: number; reason: string }) => void;
  loading: boolean;
}) {
  const [type, setType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [value, setValue] = useState("10");
  const [reason, setReason] = useState(DISCOUNT_REASONS[0]!);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ type, value: Number(value), reason });
      }}
      className="space-y-4"
    >
      <Select label="Discount type" value={type} onChange={(e) => setType(e.target.value as "PERCENTAGE" | "FLAT")}>
        <option value="PERCENTAGE">Percentage (%)</option>
        <option value="FLAT">Flat amount (₹)</option>
      </Select>
      <Input label="Value" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} required />
      <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        {DISCOUNT_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <Button type="submit" fullWidth loading={loading}>
        Apply Discount
      </Button>
    </form>
  );
}

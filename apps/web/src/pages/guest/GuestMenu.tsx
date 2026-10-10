import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChefHat, Clock, Gift, Minus, Plus, Receipt, ShoppingBag, Utensils } from "lucide-react";
import { cn } from "@saffra/ui";
import { guestApi, type GuestMenuItem, type GuestStatus } from "../../api/guest.js";
import { ApiError } from "../../api/client.js";

/**
 * What a guest sees after scanning their table's QR code. Written for
 * someone who has never used a digital menu: big tap targets, plain words,
 * one obvious next step on every screen.
 */

type Cart = Record<string, { quantity: number; notes: string }>;

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const ART: [RegExp, string][] = [
  [/dessert|sweet|ice/i, "🍨"],
  [/beverage|drink|juice|lassi|coffee|tea|shake/i, "🥤"],
  [/bread|naan|roti/i, "🫓"],
  [/biryani|rice/i, "🍚"],
  [/soup/i, "🍲"],
  [/starter|snack|appetiser|appetizer/i, "🥟"],
  [/south|dosa|idli/i, "🥞"],
  [/main|curry|gravy/i, "🍛"],
];
const artFor = (category: string) => ART.find(([re]) => re.test(category))?.[1] ?? "🍽️";

function loadCart(token: string): Cart {
  try {
    return JSON.parse(localStorage.getItem(`saffra.guest.cart.${token}`) || "{}");
  } catch {
    return {};
  }
}
function saveCart(token: string, cart: Cart) {
  try {
    localStorage.setItem(`saffra.guest.cart.${token}`, JSON.stringify(cart));
  } catch {
    // private mode / storage blocked — the cart just won't survive a reload
  }
}

export function GuestMenuPage() {
  const { token = "" } = useParams();
  const menu = useQuery({ queryKey: ["guest-menu", token], queryFn: () => guestApi.menu(token), retry: 1 });
  const status = useQuery({ queryKey: ["guest-status", token], queryFn: () => guestApi.status(token), refetchInterval: 4000, enabled: menu.isSuccess });
  const [cart, setCart] = useState<Cart>(() => loadCart(token));
  const [view, setView] = useState<"menu" | "cart" | "status">("menu");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => saveCart(token, cart), [token, cart]);
  // Returning guests (page reopened) land on their order's progress.
  useEffect(() => {
    if (status.data?.requests.length && view === "menu" && Object.keys(cart).length === 0 && !sessionStorage.getItem(`saffra.guest.seen.${token}`)) {
      setView("status");
    }
    try {
      sessionStorage.setItem(`saffra.guest.seen.${token}`, "1");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data]);

  const itemsById = useMemo(() => {
    const map = new Map<string, GuestMenuItem & { category: string }>();
    menu.data?.categories.forEach((c) => c.items.forEach((i) => map.set(i.id, { ...i, category: c.name })));
    return map;
  }, [menu.data]);

  const lines = Object.entries(cart)
    .map(([id, line]) => ({ item: itemsById.get(id), ...line }))
    .filter((l): l is { item: GuestMenuItem & { category: string }; quantity: number; notes: string } => !!l.item && l.quantity > 0);
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.quantity * l.item.price, 0);

  const setQty = (id: string, quantity: number) =>
    setCart((c) => {
      const next = { ...c };
      if (quantity <= 0) delete next[id];
      else next[id] = { notes: c[id]?.notes ?? "", quantity: Math.min(quantity, 20) };
      return next;
    });

  if (menu.isLoading) {
    return (
      <Shell>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-muted">
          <Utensils className="h-10 w-10 animate-pulse text-accent" />
          <p className="text-base">Opening the menu…</p>
        </div>
      </Shell>
    );
  }
  if (menu.isError || !menu.data) {
    return (
      <Shell>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="text-5xl">🙏</span>
          <p className="font-display text-xl font-bold text-primary">This table code isn't working</p>
          <p className="text-base text-muted">
            {menu.error instanceof ApiError ? menu.error.message : "Please check you're connected to the restaurant's Wi-Fi, or ask a staff member."}
          </p>
        </div>
      </Shell>
    );
  }

  const data = menu.data;
  const pendingRequests = status.data?.requests.filter((r) => r.kind === "ORDER" && r.status === "PENDING").length ?? 0;

  if (view === "cart") {
    return (
      <CartView
        token={token}
        lines={lines}
        total={total}
        loyalty={!!data.loyalty}
        onBack={() => setView("menu")}
        onQty={setQty}
        onNotes={(id, notes) => setCart((c) => ({ ...c, [id]: { quantity: c[id]?.quantity ?? 1, notes } }))}
        onPlaced={() => {
          setCart({});
          status.refetch();
          setView("status");
        }}
      />
    );
  }
  if (view === "status") {
    return (
      <StatusView
        token={token}
        tableNumber={data.table.number}
        status={status.data}
        onOrderMore={() => setView("menu")}
        onRefresh={() => status.refetch()}
      />
    );
  }

  return (
    <Shell>
      <header className="bg-primary px-5 pb-6 pt-7 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/60">Welcome to</p>
            <h1 className="font-display text-2xl font-bold leading-tight">{data.restaurant.name}</h1>
          </div>
          <span className="shrink-0 rounded-2xl bg-white/10 px-3.5 py-2 text-center">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/60">Table</span>
            <span className="block font-display text-2xl font-bold leading-none">{data.table.number}</span>
          </span>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-white/80">Tap <b className="text-white">Add</b> on any dish. When you're ready, send your order — a waiter confirms it and the kitchen starts cooking.</p>
        {(status.data?.requests.length ?? 0) > 0 && (
          <button onClick={() => setView("status")} className="mt-4 flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left">
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              <Clock className="h-5 w-5 text-accent" /> {pendingRequests > 0 ? "Waiting for a waiter to confirm" : "See your order"}
            </span>
            <span className="text-sm text-white/70">View →</span>
          </button>
        )}
      </header>

      <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-borderc bg-white/95 px-4 py-3 backdrop-blur scrollbar-none">
        {data.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setActiveCategory(c.id);
              sectionRefs.current[c.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={cn(
              "shrink-0 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors",
              activeCategory === c.id ? "bg-primary text-white" : "bg-bg text-primary",
            )}
          >
            {artFor(c.name)} {c.name}
          </button>
        ))}
      </nav>

      <main className="space-y-8 px-4 pb-36 pt-5">
        {data.loyalty && (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4">
            <Gift className="h-7 w-7 shrink-0 text-accent" />
            <p className="text-[15px] text-primary">
              Earn <b>{data.loyalty.earnPercent}% back</b> as reward points — just add your phone number when you order.
            </p>
          </div>
        )}
        {data.categories.map((c) => (
          <section key={c.id} ref={(el) => (sectionRefs.current[c.id] = el)} className="scroll-mt-20">
            <h2 className="mb-3 font-display text-xl font-bold text-primary">
              {artFor(c.name)} {c.name}
            </h2>
            <div className="space-y-3">
              {c.items.map((item) => (
                <DishCard key={item.id} item={item} art={artFor(c.name)} quantity={cart[item.id]?.quantity ?? 0} onQty={(q) => setQty(item.id, q)} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md p-4">
          <button
            onClick={() => setView("cart")}
            className="flex w-full animate-slide-up items-center justify-between rounded-2xl bg-accent px-5 py-4 text-white shadow-[0_12px_30px_-8px_rgba(214,58,94,.6)]"
          >
            <span className="flex items-center gap-2.5 text-[17px] font-bold">
              <ShoppingBag className="h-6 w-6" /> {count} item{count > 1 ? "s" : ""} · {rupees(total)}
            </span>
            <span className="text-[17px] font-bold">Review order →</span>
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-screen max-w-md bg-white font-sans text-primary shadow-card">{children}</div>;
}

function VegMark({ type }: { type: GuestMenuItem["foodType"] }) {
  const veg = type === "VEG";
  return (
    <span
      title={veg ? "Vegetarian" : type === "EGG" ? "Contains egg" : "Non-vegetarian"}
      className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2", veg ? "border-success" : type === "EGG" ? "border-warning" : "border-danger")}
    >
      <span className={cn("h-2 w-2 rounded-full", veg ? "bg-success" : type === "EGG" ? "bg-warning" : "bg-danger")} />
    </span>
  );
}

function DishCard({ item, art, quantity, onQty }: { item: GuestMenuItem; art: string; quantity: number; onQty: (q: number) => void }) {
  return (
    <div className={cn("flex gap-3.5 rounded-2xl border border-borderc p-3.5", !item.available && "opacity-55")}>
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-rose-100 via-emerald-50 to-teal-100 text-5xl">
        {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : art}
        {item.popular && <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-accent">★ Popular</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <span className="mt-1">
            <VegMark type={item.foodType} />
          </span>
          <p className="text-[17px] font-bold leading-snug">{item.name}</p>
        </div>
        {item.description && <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-2.5">
          <span className="font-display text-lg font-bold">{rupees(item.price)}</span>
          {!item.available ? (
            <span className="rounded-full bg-bg px-3 py-2 text-sm font-semibold text-muted">Sold out</span>
          ) : quantity === 0 ? (
            <button onClick={() => onQty(1)} aria-label={`Add ${item.name}`} className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-5 text-base font-bold text-white active:scale-95">
              <Plus className="h-5 w-5" /> Add
            </button>
          ) : (
            <Stepper value={quantity} onChange={onQty} label={item.name} />
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex h-11 items-center overflow-hidden rounded-xl bg-success text-white">
      <button onClick={() => onChange(value - 1)} aria-label={`One less ${label}`} className="flex h-11 w-11 items-center justify-center active:bg-black/10">
        <Minus className="h-5 w-5" />
      </button>
      <span className="w-7 text-center text-lg font-bold">{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label={`One more ${label}`} className="flex h-11 w-11 items-center justify-center active:bg-black/10">
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}

function CartView({
  token,
  lines,
  total,
  loyalty,
  onBack,
  onQty,
  onNotes,
  onPlaced,
}: {
  token: string;
  lines: { item: GuestMenuItem; quantity: number; notes: string }[];
  total: number;
  loyalty: boolean;
  onBack: () => void;
  onQty: (id: string, q: number) => void;
  onNotes: (id: string, notes: string) => void;
  onPlaced: () => void;
}) {
  const [name, setName] = useState(() => localStorage.getItem("saffra.guest.name") ?? "");
  const [phone, setPhone] = useState(() => localStorage.getItem("saffra.guest.phone") ?? "");
  const [note, setNote] = useState("");
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const place = useMutation({
    mutationFn: () =>
      guestApi.placeOrder(token, {
        items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity, notes: l.notes || null })),
        note: note || null,
        guestName: name || null,
        guestPhone: phone || null,
      }),
    onSuccess: () => {
      try {
        localStorage.setItem("saffra.guest.name", name);
        localStorage.setItem("saffra.guest.phone", phone);
      } catch {
        /* ignore */
      }
      onPlaced();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't send your order. Please check the Wi-Fi and try again."),
  });

  return (
    <Shell>
      <header className="flex items-center gap-3 border-b border-borderc px-4 py-4">
        <button onClick={onBack} aria-label="Back to menu" className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="font-display text-xl font-bold">Your order</h1>
      </header>

      <main className="space-y-5 px-4 pb-40 pt-4">
        {lines.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-lg font-semibold">Nothing added yet</p>
            <button onClick={onBack} className="mt-4 rounded-xl bg-primary px-6 py-3 text-base font-bold text-white">
              Go to the menu
            </button>
          </div>
        ) : (
          <div className="divide-y divide-borderc rounded-2xl border border-borderc">
            {lines.map(({ item, quantity, notes }) => (
              <div key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <VegMark type={item.foodType} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-bold">{item.name}</p>
                    <p className="text-sm text-muted">{rupees(item.price)} each</p>
                  </div>
                  <Stepper value={quantity} onChange={(q) => onQty(item.id, q)} label={item.name} />
                </div>
                {openNote === item.id || notes ? (
                  <input
                    autoFocus={openNote === item.id}
                    value={notes}
                    onChange={(e) => onNotes(item.id, e.target.value.slice(0, 200))}
                    placeholder="e.g. less spicy, no onion"
                    className="mt-3 w-full rounded-xl border border-borderc px-3.5 py-3 text-base outline-none focus:border-secondary"
                  />
                ) : (
                  <button onClick={() => setOpenNote(item.id)} className="mt-2 text-[15px] font-semibold text-secondary">
                    + Add a special request
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && (
          <>
            <div className="space-y-3 rounded-2xl bg-bg p-4">
              <p className="text-[15px] font-bold">Your details (optional)</p>
              {loyalty && (
                <p className="flex items-center gap-2 text-sm text-accent">
                  <Gift className="h-4 w-4" /> Add your phone number to earn reward points.
                </p>
              )}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className="w-full rounded-xl border border-borderc bg-white px-3.5 py-3 text-base outline-none focus:border-secondary" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" autoComplete="tel" className="w-full rounded-xl border border-borderc bg-white px-3.5 py-3 text-base outline-none focus:border-secondary" />
              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} placeholder="Anything else for the kitchen? (e.g. a birthday, allergies)" className="w-full resize-none rounded-xl border border-borderc bg-white px-3.5 py-3 text-base outline-none focus:border-secondary" />
            </div>
            <div className="flex items-center justify-between px-1 text-[17px]">
              <span className="text-muted">Food total</span>
              <span className="font-display text-xl font-bold">{rupees(total)}</span>
            </div>
            <p className="px-1 text-sm text-muted">Taxes and service charge are added on the final bill. You pay at the end of your meal.</p>
            {error && <p className="rounded-xl bg-danger/10 p-3.5 text-[15px] font-medium text-danger">{error}</p>}
          </>
        )}
      </main>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-borderc bg-white p-4">
          <button
            onClick={() => {
              setError(null);
              place.mutate();
            }}
            disabled={place.isPending}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-bold text-white disabled:opacity-60"
          >
            {place.isPending ? "Sending…" : <>Send order to the waiter · {rupees(total)}</>}
          </button>
        </div>
      )}
    </Shell>
  );
}

const STEP_LABELS = ["Sent", "Confirmed", "Cooking", "Served"];

function StatusView({
  token,
  tableNumber,
  status,
  onOrderMore,
  onRefresh,
}: {
  token: string;
  tableNumber: number;
  status: GuestStatus | undefined;
  onOrderMore: () => void;
  onRefresh: () => void;
}) {
  const [billAsked, setBillAsked] = useState(false);
  const bill = useMutation({ mutationFn: () => guestApi.requestBill(token), onSuccess: () => setBillAsked(true) });
  const latest = status?.requests.find((r) => r.kind === "ORDER");
  const items = status?.order?.items ?? [];
  const cooking = items.some((i) => i.kitchenStatus === "FIRED");
  const allServed = items.length > 0 && items.every((i) => i.kitchenStatus === "SERVED");
  const step = !latest ? 0 : latest.status === "PENDING" ? 0 : latest.status === "DECLINED" ? -1 : allServed ? 3 : cooking ? 2 : 1;
  const billPending = billAsked || status?.requests.some((r) => r.kind === "BILL" && r.status === "PENDING");

  return (
    <Shell>
      <header className="flex items-center justify-between border-b border-borderc px-5 py-4">
        <h1 className="font-display text-xl font-bold">Table {tableNumber}</h1>
        <button onClick={onRefresh} className="text-sm font-semibold text-secondary">
          Refresh
        </button>
      </header>
      <main className="space-y-5 px-4 pb-44 pt-5">
        {latest && step >= 0 && (
          <div className="rounded-3xl bg-primary p-5 text-white">
            <div className="flex items-center gap-3">
              {step === 0 ? <Clock className="h-9 w-9 animate-pulse text-accent" /> : step === 3 ? <CheckCircle2 className="h-9 w-9 text-success" /> : <ChefHat className="h-9 w-9 text-accent" />}
              <div>
                <p className="font-display text-xl font-bold">
                  {step === 0 ? "Order sent!" : step === 1 ? "Order confirmed" : step === 2 ? "The kitchen is cooking" : "Enjoy your meal!"}
                </p>
                <p className="text-[15px] text-white/70">
                  {step === 0 ? "A waiter will confirm it in a moment." : step === 2 ? "We'll bring it to your table." : step === 3 ? "Tap “Order more” any time." : "It's on its way to the kitchen."}
                </p>
              </div>
            </div>
            <ol className="mt-5 grid grid-cols-4 gap-1.5">
              {STEP_LABELS.map((label, i) => (
                <li key={label} className="text-center">
                  <span className={cn("block h-2 rounded-full transition-colors duration-500", i <= step ? "bg-accent" : "bg-white/15")} />
                  <span className={cn("mt-1.5 block text-xs font-semibold", i <= step ? "text-white" : "text-white/40")}>{label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {latest?.status === "DECLINED" && (
          <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
            <p className="text-[17px] font-bold text-danger">The restaurant couldn't take your last order</p>
            <p className="mt-1 text-[15px] text-primary">{latest.declineReason ?? "A staff member will come to your table."}</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="rounded-2xl border border-borderc">
            <p className="border-b border-borderc px-4 py-3 text-[15px] font-bold">On your table's bill</p>
            <ul className="divide-y divide-borderc">
              {items.map((i, idx) => (
                <li key={idx} className="flex items-center justify-between px-4 py-3 text-[15px]">
                  <span>
                    {i.quantity} × {i.name}
                  </span>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", i.kitchenStatus === "SERVED" ? "bg-success/10 text-success" : i.kitchenStatus === "FIRED" ? "bg-warning/10 text-warning" : "bg-bg text-muted")}>
                    {i.kitchenStatus === "SERVED" ? "Served" : i.kitchenStatus === "FIRED" ? "Cooking" : "Waiting"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-borderc px-4 py-3">
              <span className="text-[15px] text-muted">Bill so far (incl. taxes)</span>
              <span className="font-display text-lg font-bold">{rupees(status?.order?.grandTotal ?? 0)}</span>
            </div>
          </div>
        )}

        {status?.requests
          .filter((r) => r.kind === "ORDER" && r.status === "PENDING")
          .map((r) => (
            <div key={r.id} className="rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-4">
              <p className="text-[15px] font-bold text-accent">Waiting for a waiter to confirm</p>
              <p className="mt-1 text-[15px] text-primary">{r.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
            </div>
          ))}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md space-y-2.5 border-t border-borderc bg-white p-4">
        <button onClick={onOrderMore} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white">
          <Plus className="h-5 w-5" /> Order more
        </button>
        {status?.order?.payLinkToken ? (
          <a href={`/pay/${status.order.payLinkToken}`} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary text-lg font-bold">
            <Receipt className="h-5 w-5" /> Pay the bill on this phone
          </a>
        ) : (
          <button
            onClick={() => bill.mutate()}
            disabled={billPending || !status?.order || bill.isPending}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary text-lg font-bold disabled:border-borderc disabled:text-muted"
          >
            {billPending ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-success" /> A waiter is bringing your bill
              </>
            ) : (
              <>
                <Receipt className="h-5 w-5" /> Ask for the bill
              </>
            )}
          </button>
        )}
      </div>
    </Shell>
  );
}

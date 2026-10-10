import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Receipt, Smartphone, X } from "lucide-react";
import { Button, Modal, cn, toast } from "@saffra/ui";
import { guestRequestsApi, type GuestRequestDTO } from "../../api/guest.js";
import { ApiError } from "../../api/client.js";
import { GUEST_REQUEST_EVENT } from "../../hooks/useRealtime.js";
import { playChime } from "../../lib/chime.js";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function minutesAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m === 0 ? "just now" : `${m} min ago`;
}

/**
 * Orders and bill requests guests send from their table's QR code. Lives in
 * the top bar on every screen so nobody has to go looking: it lights up in the accent colour,
 * chimes, and one tap shows what each table wants.
 */
export function GuestRequestsButton() {
  const [open, setOpen] = useState(false);
  const { data: requests = [] } = useQuery({ queryKey: ["guest-requests"], queryFn: guestRequestsApi.list, refetchInterval: 15000 });

  useEffect(() => {
    const onNew = (e: Event) => {
      const detail = (e as CustomEvent<{ tableNumber?: number; kind?: string }>).detail;
      playChime();
      toast.success(
        detail?.kind === "BILL" ? `Table ${detail?.tableNumber} wants the bill` : `New order from Table ${detail?.tableNumber}`,
        "Tap “Guest orders” at the top to see it.",
      );
    };
    window.addEventListener(GUEST_REQUEST_EVENT, onNew);
    return () => window.removeEventListener(GUEST_REQUEST_EVENT, onNew);
  }, []);

  const count = requests.length;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors",
          count > 0 ? "animate-pulse-glow bg-accent text-white shadow-[0_6px_18px_-6px_rgba(214,58,94,.7)]" : "text-muted hover:bg-bg hover:text-primary",
        )}
        aria-label={count ? `${count} guest orders waiting` : "Guest orders"}
      >
        <BellRing className="h-5 w-5" />
        <span className="hidden sm:inline">Guest orders</span>
        {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-accent">{count}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Orders from guests' phones" size="lg">
        {count === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Smartphone className="h-9 w-9 text-borderc" />
            <p className="text-sm font-semibold text-primary">Nothing waiting</p>
            <p className="max-w-sm text-sm text-muted">When guests scan the QR code on their table and order, it appears here for you to confirm.</p>
          </div>
        ) : (
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} onDone={() => requests.length === 1 && setOpen(false)} />
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

function RequestCard({ request, onDone }: { request: GuestRequestDTO; onDone: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["guest-requests"] });
    queryClient.invalidateQueries({ queryKey: ["tables"] });
    queryClient.invalidateQueries({ queryKey: ["kitchen"] });
  };
  const accept = useMutation({
    mutationFn: () => guestRequestsApi.accept(request.id),
    onSuccess: (res) => {
      refresh();
      toast.success(request.kind === "BILL" ? `Bringing the bill to Table ${request.tableNumber}` : `Table ${request.tableNumber}'s order is with the kitchen`);
      onDone();
      if (request.kind === "BILL") navigate("/tables");
      void res;
    },
    onError: (err) => toast.error("Couldn't accept", err instanceof ApiError ? err.message : undefined),
  });
  const decline = useMutation({
    mutationFn: () => guestRequestsApi.decline(request.id, reason || undefined),
    onSuccess: () => {
      refresh();
      toast.success("The guest has been told");
      onDone();
    },
    onError: (err) => toast.error("Couldn't decline", err instanceof ApiError ? err.message : undefined),
  });

  const isBill = request.kind === "BILL";
  return (
    <div className="rounded-2xl border border-borderc p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-white">
            <span className="text-[9px] font-semibold uppercase leading-none text-white/60">Table</span>
            <span className="font-display text-lg font-bold leading-tight">{request.tableNumber}</span>
          </span>
          <div>
            <p className="text-base font-bold text-primary">{isBill ? "Asked for the bill" : `New order${request.guestName ? ` · ${request.guestName}` : ""}`}</p>
            <p className="text-xs text-muted">From the table's QR code · {minutesAgo(request.createdAt)}</p>
          </div>
        </div>
        {!isBill && <span className="font-display text-base font-bold text-primary">{rupees(request.estimatedTotal)}</span>}
      </div>

      {!isBill && (
        <ul className="mt-3 space-y-1.5 rounded-xl bg-bg p-3">
          {request.items.map((i, idx) => (
            <li key={idx} className="text-sm text-primary">
              <span className="font-mono font-bold text-accent">{i.quantity}×</span> {i.name}
              {i.notes && <span className="block pl-7 text-xs font-medium text-warning">“{i.notes}”</span>}
            </li>
          ))}
          {request.note && <li className="pt-1 text-xs font-medium text-warning">Note: {request.note}</li>}
        </ul>
      )}

      {declining ? (
        <div className="mt-3 space-y-2">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason the guest will see (e.g. Paneer is sold out)"
            className="w-full rounded-xl border border-borderc px-3 py-2.5 text-sm outline-none focus:border-secondary"
          />
          <div className="flex gap-2">
            <Button variant="danger" loading={decline.isPending} onClick={() => decline.mutate()}>
              Decline order
            </Button>
            <Button variant="outline" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="lg" variant="success" className="flex-1" loading={accept.isPending} onClick={() => accept.mutate()}>
            {isBill ? (
              <>
                <Receipt className="h-5 w-5" /> On my way
              </>
            ) : (
              <>
                <Check className="h-5 w-5" /> Accept & send to kitchen
              </>
            )}
          </Button>
          {!isBill && (
            <Button size="lg" variant="outline" onClick={() => setDeclining(true)} aria-label="Decline order">
              <X className="h-5 w-5" /> Decline
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

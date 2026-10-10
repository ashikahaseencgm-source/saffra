import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, StickyNote, CheckCircle2, Flame, Undo2, Timer, AlertTriangle, User } from "lucide-react";
import { cn, toast } from "@saffra/ui";
import { kitchenApi, type KitchenTicketDTO } from "../api/kitchen.js";
import { ApiError } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.js";
import { playChime } from "../lib/chime.js";

const COLUMN_DEFS: { status: KitchenTicketDTO["status"]; label: string; actionLabel: string; accent: string }[] = [
  { status: "NEW", label: "New", actionLabel: "Accept", accent: "border-t-secondary" },
  { status: "ACCEPTED", label: "Accepted", actionLabel: "Start Preparing", accent: "border-t-warning" },
  { status: "PREPARING", label: "Preparing", actionLabel: "Mark Ready", accent: "border-t-accent" },
  { status: "READY", label: "Ready", actionLabel: "Complete", accent: "border-t-success" },
];

export function KitchenPage() {
  const queryClient = useQueryClient();
  const { data: tickets } = useQuery({ queryKey: ["kitchen", "tickets"], queryFn: kitchenApi.listTickets, refetchInterval: 5000 });
  const knownTicketIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!tickets) return;
    const currentIds = new Set(tickets.map((t) => t.id));
    if (knownTicketIds.current) {
      const isNewArrival = tickets.some((t) => t.status === "NEW" && !knownTicketIds.current!.has(t.id));
      if (isNewArrival) playChime();
    }
    knownTicketIds.current = currentIds;
  }, [tickets]);

  const advance = useMutation({
    mutationFn: (id: string) => kitchenApi.advance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err) => toast.error("Couldn't update ticket", err instanceof ApiError ? err.message : undefined),
  });

  const recall = useMutation({
    mutationFn: (id: string) => kitchenApi.recall(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.info("Ticket recalled");
    },
    onError: (err) => toast.error("Couldn't recall ticket", err instanceof ApiError ? err.message : undefined),
  });

  const activeCount = tickets?.length ?? 0;
  const avgElapsed = activeCount ? Math.round((tickets ?? []).reduce((s, t) => s + t.elapsedMinutes, 0) / activeCount) : 0;
  const urgentCount = (tickets ?? []).filter((t) => t.elapsedMinutes >= 15).length;

  return (
    <div data-tour-target="kitchen" className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Live"
        title="Kitchen Display"
        description="Tickets update automatically — a chime plays when a new one lands."
        actions={
          <div className="flex items-center gap-2">
            <SummaryPill icon={Timer} label="Active" value={activeCount} />
            <SummaryPill icon={Clock} label="Avg wait" value={`${avgElapsed}m`} />
            <SummaryPill icon={AlertTriangle} label="Urgent" value={urgentCount} tone={urgentCount > 0 ? "danger" : "default"} />
          </div>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMN_DEFS.map((col, colIndex) => {
          const columnTickets = (tickets ?? []).filter((t) => t.status === col.status);
          return (
            <div key={col.status} className={cn("min-h-[55vh] rounded-2xl border border-t-4 border-borderc bg-white p-3 shadow-card", col.accent)}>
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{col.label}</p>
                <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-bold text-primary">{columnTickets.length}</span>
              </div>
              <div className="space-y-3">
                {columnTickets.map((ticket) => (
                  <KitchenTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    actionLabel={col.actionLabel}
                    canRecall={colIndex > 0}
                    advancing={advance.isPending && advance.variables === ticket.id}
                    recalling={recall.isPending && recall.variables === ticket.id}
                    disabled={advance.isPending || recall.isPending}
                    onAdvance={() => advance.mutate(ticket.id)}
                    onRecall={() => recall.mutate(ticket.id)}
                  />
                ))}
                {columnTickets.length === 0 && (
                  <div className="rounded-xl border border-dashed border-borderc py-8 text-center text-xs text-muted">No tickets</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryPill({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Timer;
  label: string;
  value: string | number;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        tone === "danger" ? "border-danger/30 bg-danger/10 text-danger" : "border-borderc bg-bg text-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="font-bold text-primary">{value}</span>
    </div>
  );
}

function KitchenTicketCard({
  ticket,
  actionLabel,
  canRecall,
  advancing,
  recalling,
  disabled,
  onAdvance,
  onRecall,
}: {
  ticket: KitchenTicketDTO;
  actionLabel: string;
  canRecall: boolean;
  advancing: boolean;
  recalling: boolean;
  disabled: boolean;
  onAdvance: () => void;
  onRecall: () => void;
}) {
  const urgent = ticket.elapsedMinutes >= 15;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3.5 shadow-card transition-shadow",
        urgent ? "border-danger/40 shadow-[0_0_0_1px_rgba(220,38,38,0.15)]" : "border-borderc",
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-base font-bold text-primary">{ticket.ticketNumber}</p>
            {ticket.round > 1 && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                More items · #{ticket.round}
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            {ticket.tableNumber ? `Table ${ticket.tableNumber}` : "Takeaway"} · {ticket.waiterName}
          </p>
          {ticket.customerName && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-secondary">
              <User className="h-3 w-3" /> {ticket.customerName}
            </p>
          )}
        </div>
        <div className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold", urgent ? "bg-danger/10 text-danger" : "bg-bg text-muted")}>
          {urgent && <Flame className="h-3 w-3" />}
          <Clock className="h-3 w-3" />
          {ticket.elapsedMinutes}m
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-borderc pt-3">
        {ticket.items.map((item, i) => (
          <div key={i} className="flex items-start justify-between text-sm">
            <span className="text-primary">{item.name}</span>
            <span className="font-mono font-bold text-accent">×{item.quantity}</span>
          </div>
        ))}
        {ticket.items.map((item, i) =>
          item.notes ? (
            <p key={`n-${i}`} className="flex items-center gap-1 text-[11px] font-medium text-warning">
              <StickyNote className="h-3 w-3" /> {item.name}: {item.notes}
            </p>
          ) : null,
        )}
        {ticket.note && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-warning">
            <StickyNote className="h-3 w-3" /> {ticket.note}
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {canRecall && (
          <button
            onClick={onRecall}
            disabled={disabled}
            title="Undo last action"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-borderc text-muted transition-colors hover:bg-bg hover:text-primary disabled:opacity-40"
          >
            {recalling ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-transparent" /> : <Undo2 className="h-4 w-4" />}
          </button>
        )}
        <button
          onClick={onAdvance}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {advancing ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

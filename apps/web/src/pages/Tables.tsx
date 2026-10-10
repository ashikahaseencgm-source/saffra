import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Clock, Plus, Wallet, CheckCircle2, QrCode as QrIcon } from "lucide-react";
import { Skeleton, toast, cn } from "@saffra/ui";
import type { TableDTO, TableStatus } from "@saffra/types";
import { tablesApi } from "../api/tables.js";
import { useAuthStore } from "../store/authStore.js";
import { ordersApi } from "../api/orders.js";
import { PageHeader } from "../components/PageHeader.js";
import { ApiError } from "../api/client.js";
import { CustomerLookupModal } from "../components/customer/CustomerLookupModal.js";
import { PaymentCheckoutModal } from "../components/payment/PaymentCheckoutModal.js";

// Mirrors PAYABLE_ORDER_STATUSES on the backend — a table can be billed any
// time from CONFIRMED (ordering) through PAYMENT_PENDING, not just once
// everything's been served.
const BILLABLE_TABLE_STATUSES: TableStatus[] = ["OCCUPIED", "ORDERING", "FOOD_PREPARING", "READY_TO_SERVE", "PAYMENT_PENDING"];

const STATUS_RING: Record<TableStatus, string> = {
  AVAILABLE: "ring-success/40 shadow-[0_0_0_1px_rgba(22,163,74,0.15)]",
  OCCUPIED: "ring-secondary/50",
  ORDERING: "ring-secondary/50",
  FOOD_PREPARING: "ring-warning/60",
  READY_TO_SERVE: "ring-accent/60",
  PAYMENT_PENDING: "ring-warning/70",
  COMPLETED: "ring-success/40",
  RESERVED: "ring-muted/40",
};

const STATUS_LABEL: Record<TableStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  ORDERING: "Ordering",
  FOOD_PREPARING: "Food Preparing",
  READY_TO_SERVE: "Ready to Serve",
  PAYMENT_PENDING: "Payment Pending",
  COMPLETED: "Completed",
  RESERVED: "Reserved",
};

const STATUS_TEXT: Record<TableStatus, string> = {
  AVAILABLE: "text-success",
  OCCUPIED: "text-secondary",
  ORDERING: "text-secondary",
  FOOD_PREPARING: "text-warning",
  READY_TO_SERVE: "text-accent",
  PAYMENT_PENDING: "text-warning",
  COMPLETED: "text-success",
  RESERVED: "text-muted",
};

export function TablesPage() {
  const navigate = useNavigate();
  const canManage = useAuthStore((s) => s.user?.role === "MANAGER" || s.user?.role === "ADMIN");
  const queryClient = useQueryClient();
  const { data: tables, isLoading } = useQuery({ queryKey: ["tables"], queryFn: tablesApi.list, refetchInterval: 10000 });
  const [pendingTableId, setPendingTableId] = useState<string | null>(null);
  const [billTable, setBillTable] = useState<TableDTO | null>(null);

  const createOrder = useMutation({
    mutationFn: (data: { tableId: string; customerId: string | null; customerName: string | null }) =>
      ordersApi.create({ tableId: data.tableId, orderType: "DINE_IN", customerId: data.customerId, customerName: data.customerName }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      navigate(`/order/${order.id}`);
    },
    onError: (err) => toast.error("Couldn't open order", err instanceof ApiError ? err.message : undefined),
  });

  const clearTable = useMutation({
    mutationFn: (orderId: string) => ordersApi.complete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Table cleared");
    },
    onError: (err) => toast.error("Couldn't clear table", err instanceof ApiError ? err.message : undefined),
  });

  function handleTableClick(table: TableDTO) {
    if (table.currentOrderId) {
      navigate(`/order/${table.currentOrderId}`);
      return;
    }
    if (table.status !== "AVAILABLE" && table.status !== "RESERVED") {
      toast.warning("Table is not available", "Check the table status before starting a new order.");
      return;
    }
    setPendingTableId(table.id);
  }

  const counts = (tables ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div data-tour-target="tables" className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Floor"
        title="Tables"
        description={`${tables?.length ?? 0} tables · ${counts.AVAILABLE ?? 0} available now`}
        actions={
          canManage && (
            <button
              onClick={() => navigate("/tables/qr")}
              className="flex h-11 items-center gap-2 rounded-xl border border-borderc bg-white px-4 text-sm font-semibold text-primary hover:bg-bg"
            >
              <QrIcon className="h-4 w-4" /> Table QR codes
            </button>
          )
        }
      />

      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5 rounded-full border border-borderc bg-white px-3 py-1.5 text-xs font-medium text-muted">
            <span className={cn("h-2 w-2 rounded-full", STATUS_TEXT[status as TableStatus].replace("text-", "bg-"))} />
            {label}
            <span className="font-semibold text-primary">{counts[status] ?? 0}</span>
          </div>
        ))}
      </div>

      <div className="relative mt-6 rounded-card border border-borderc bg-white p-6 shadow-card">
        <div className="pointer-events-none absolute inset-0 rounded-card bg-dot-grid-light bg-dot-sm opacity-40" />
        <div className="relative grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-44" />)
            : tables?.map((table) => (
                <TableTile
                  key={table.id}
                  table={table}
                  onClick={() => handleTableClick(table)}
                  onBill={BILLABLE_TABLE_STATUSES.includes(table.status) ? () => setBillTable(table) : undefined}
                  onClear={
                    table.status === "COMPLETED" && table.currentOrderId
                      ? () => clearTable.mutate(table.currentOrderId!)
                      : undefined
                  }
                  clearing={clearTable.isPending && clearTable.variables === table.currentOrderId}
                />
              ))}
        </div>
      </div>

      <CustomerLookupModal
        open={!!pendingTableId}
        onClose={() => setPendingTableId(null)}
        onStart={({ customerId, customerName }) => {
          if (!pendingTableId) return;
          const tableId = pendingTableId;
          setPendingTableId(null);
          createOrder.mutate({ tableId, customerId, customerName });
        }}
      />

      {billTable?.currentOrderId && (
        <PaymentCheckoutModal
          open={!!billTable}
          orderId={billTable.currentOrderId}
          amount={billTable.currentBillTotal}
          onClose={() => setBillTable(null)}
          onSuccess={() => {
            const orderId = billTable.currentOrderId;
            setBillTable(null);
            queryClient.invalidateQueries({ queryKey: ["tables"] });
            if (orderId) navigate(`/orders/${orderId}/receipt`);
          }}
        />
      )}
    </div>
  );
}

function TableTile({
  table,
  onClick,
  onBill,
  onClear,
  clearing,
}: {
  table: TableDTO;
  onClick: () => void;
  onBill?: () => void;
  onClear?: () => void;
  clearing?: boolean;
}) {
  const isRound = table.capacity <= 4;
  const seatCount = Math.min(table.capacity, 8);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="group flex cursor-pointer flex-col items-center rounded-2xl border border-borderc/70 bg-bg/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-borderc hover:shadow-elevated"
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        {Array.from({ length: seatCount }).map((_, i) => {
          const angle = (360 / seatCount) * i;
          return (
            <span
              key={i}
              className="absolute h-2.5 w-2.5 rounded-full bg-borderc"
              style={{ transform: `rotate(${angle}deg) translate(0, -38px)` }}
            />
          );
        })}
        <div
          className={cn(
            "flex items-center justify-center border-2 bg-white font-display text-lg font-bold text-primary ring-4 transition-all",
            isRound ? "h-14 w-14 rounded-full" : "h-12 w-16 rounded-xl",
            STATUS_RING[table.status],
            "border-white",
          )}
        >
          {table.number}
        </div>
      </div>

      <p className={cn("mt-3 text-xs font-semibold", STATUS_TEXT[table.status])}>{STATUS_LABEL[table.status]}</p>

      <div className="mt-1.5 flex items-center gap-1 text-xs text-muted">
        <Users className="h-3 w-3" />
        {table.capacity} Guests
      </div>

      {table.currentOrderId && (
        <div className="mt-2 w-full space-y-1 border-t border-borderc/70 pt-2 text-center">
          <p className="font-display text-sm font-bold text-primary">₹{table.currentBillTotal.toLocaleString("en-IN")}</p>
          {table.customerName && (
            <p className="truncate text-[11px] font-semibold text-secondary">{table.customerName}</p>
          )}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted">
            {table.elapsedMinutes !== null && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {table.elapsedMinutes}m
              </span>
            )}
            {table.assignedWaiterName && <span className="truncate">{table.assignedWaiterName}</span>}
          </div>
          {onBill && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBill();
              }}
              className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary/90"
            >
              <Wallet className="h-3 w-3" /> Bill Customer
            </button>
          )}
          {onClear && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              disabled={clearing}
              className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-success py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-success/90 disabled:opacity-60"
            >
              {clearing ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Clear Table
            </button>
          )}
        </div>
      )}

      {!table.currentOrderId && (table.status === "AVAILABLE" || table.status === "RESERVED") && (
        <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-secondary opacity-0 transition-opacity group-hover:opacity-100">
          <Plus className="h-3.5 w-3.5" /> New order
        </div>
      )}
    </div>
  );
}

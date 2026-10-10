import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Receipt as ReceiptIcon } from "lucide-react";
import { Card, DataTable, Input, Select, EmptyState, type Column } from "@saffra/ui";
import type { OrderDTO } from "@saffra/types";
import { ordersApi } from "../api/orders.js";
import { PageHeader } from "../components/PageHeader.js";
import { StatusBadge } from "../components/StatusBadge.js";

const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

const STATUS_OPTIONS = ["all", "DRAFT", "CONFIRMED", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED", "PAYMENT_PENDING", "PAID", "COMPLETED", "CANCELLED"];

function rangeToDates(range: string): { from?: string; to?: string } {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString() };
  }
  if (range === "yesterday") {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (range === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { from: start.toISOString() };
  }
  if (range === "month") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    return { from: start.toISOString() };
  }
  return {};
}

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState("week");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const dates = useMemo(() => rangeToDates(range), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", "history", range, status, page],
    queryFn: () =>
      ordersApi.list({
        page,
        pageSize: 20,
        status: status === "all" ? undefined : status,
        from: dates.from,
        to: dates.to,
      }),
  });

  const filtered = (data?.data ?? []).filter(
    (o) => !search || o.orderNumber.toLowerCase().includes(search.toLowerCase()) || o.waiterName.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: Column<OrderDTO>[] = [
    { key: "orderNumber", header: "Order ID", render: (o) => <span className="font-mono text-xs font-semibold">{o.orderNumber}</span> },
    { key: "table", header: "Table", render: (o) => (o.tableNumber ? `Table ${o.tableNumber}` : o.orderType.replace("_", " ")) },
    { key: "waiter", header: "Waiter", render: (o) => o.waiterName },
    { key: "date", header: "Date", render: (o) => new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) },
    { key: "amount", header: "Amount", align: "right", render: (o) => `₹${o.bill.grandTotal.toLocaleString("en-IN")}` },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (o) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/orders/${o.id}/receipt`);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
        >
          <ReceiptIcon className="h-3.5 w-3.5" /> Receipt
        </button>
      ),
    },
  ];

  return (
    <div data-tour-target="orders" className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader eyebrow="History" title="Orders" description={`${data?.pagination.total ?? 0} orders found`} />

      <div className="mt-5 flex flex-wrap gap-3">
        <Input
          icon={<Search className="h-4 w-4" />}
          placeholder="Search by order ID or waiter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="max-w-xs"
        />
        <Select value={range} onChange={(e) => setRange(e.target.value)} wrapperClassName="max-w-[160px]">
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="max-w-[180px]">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>

      <Card className="mt-5">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted">Loading orders…</div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            keyField={(o) => o.id}
            onRowClick={(o) => navigate(`/order/${o.id}`)}
            emptyState={<EmptyState title="No orders found" description="Try adjusting your filters." />}
          />
        )}
      </Card>

      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: data.pagination.totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`h-8 w-8 rounded-lg font-medium ${page === i + 1 ? "bg-primary text-white" : "text-muted hover:bg-bg"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { IndianRupee, ClipboardList, UtensilsCrossed, Clock, ChefHat, Receipt, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, StatWidget, Skeleton, cn } from "@saffra/ui";
import { reportsApi } from "../api/reports.js";
import { ordersApi } from "../api/orders.js";
import { useAuthStore } from "../store/authStore.js";
import { PageHeader } from "../components/PageHeader.js";
import { StatusBadge } from "../components/StatusBadge.js";

const RECENT_ACTIVITY_LIMIT = 5;

const MANAGEMENT_ROLES = ["MANAGER", "ADMIN"];

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  // The /reports/revenue endpoint is manager/admin-only on the backend — fetching
  // and rendering it for other roles would just show a perpetually empty chart.
  const canSeeRevenue = !!user?.role && MANAGEMENT_ROLES.includes(user.role);
  const { data: stats, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: reportsApi.dashboard, refetchInterval: 15000 });
  const { data: revenue } = useQuery({
    queryKey: ["reports", "revenue", "week"],
    queryFn: () => reportsApi.revenue("week"),
    enabled: canSeeRevenue,
  });
  const { data: recentOrders } = useQuery({
    queryKey: ["orders", "recent"],
    queryFn: () => ordersApi.list({ pageSize: RECENT_ACTIVITY_LIMIT }),
  });

  return (
    <div data-tour-target="dashboard" className="mx-auto flex h-full max-w-7xl flex-col px-6 py-5">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}`}
        description={`${formatRole(user?.role)} · ${user?.employeeId}`}
      />

      <div className="mt-5 grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatWidget label="Today's Revenue" value={`₹${(stats?.todaysRevenue ?? 0).toLocaleString("en-IN")}`} icon={<IndianRupee className="h-5 w-5" />} tone="accent" />
            <StatWidget label="Today's Orders" value={stats?.todaysOrders ?? 0} icon={<ClipboardList className="h-5 w-5" />} tone="secondary" />
            <StatWidget label="Active Tables" value={stats?.activeTables ?? 0} icon={<UtensilsCrossed className="h-5 w-5" />} tone="primary" />
            <StatWidget label="Pending Payments" value={stats?.pendingPayments ?? 0} icon={<Receipt className="h-5 w-5" />} tone="accent" />
            <StatWidget label="Kitchen Orders" value={stats?.kitchenOrders ?? 0} icon={<ChefHat className="h-5 w-5" />} tone="success" />
            <StatWidget label="Avg. Bill Value" value={`₹${(stats?.averageBillValue ?? 0).toLocaleString("en-IN")}`} icon={<Clock className="h-5 w-5" />} tone="secondary" />
          </>
        )}
      </div>

      <div className={cn("mt-5 grid min-h-0 flex-1 grid-cols-1 gap-4", canSeeRevenue && "lg:grid-cols-3")}>
        {canSeeRevenue && (
          <Card className="flex min-h-0 flex-col lg:col-span-2">
            <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0">
              <CardTitle>Revenue, last 7 days</CardTitle>
              <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                <Sparkles className="h-3 w-3" /> Live
              </span>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              <div style={{ height: "clamp(200px, 32vh, 380px)" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue ?? []}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D63A5E" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#D63A5E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#E7E2D8" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7C76" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#6B7C76" }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #E7E2D8", fontSize: 12 }}
                      formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#D63A5E" strokeWidth={2.5} fill="url(#revenueFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="flex min-h-0 flex-col">
          <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0">
            <CardTitle>Recent Activity</CardTitle>
            <Link to="/orders" className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
              See more <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {recentOrders?.data.length ? (
              recentOrders.data.slice(0, RECENT_ACTIVITY_LIMIT).map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-borderc/70 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">{order.orderNumber}</p>
                    <p className="truncate text-xs text-muted">
                      {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType} · {order.waiterName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-primary">₹{order.bill.grandTotal.toLocaleString("en-IN")}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted">No orders yet today.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatRole(role?: string) {
  if (!role) return "";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

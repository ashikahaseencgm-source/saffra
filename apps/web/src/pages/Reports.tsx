import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Card, CardHeader, CardTitle, CardContent, Select, DataTable, type Column } from "@saffra/ui";
import { reportsApi, type WaiterPerformance, type TableUtilization } from "../api/reports.js";
import { PageHeader } from "../components/PageHeader.js";

const PIE_COLORS = ["#D63A5E", "#0E9F8E", "#16A34A", "#F59E0B", "#DC2626", "#6B7C76"];

export function ReportsPage() {
  const [range, setRange] = useState<"day" | "week" | "month" | "year">("week");

  const { data: revenue } = useQuery({ queryKey: ["reports", "revenue", range], queryFn: () => reportsApi.revenue(range) });
  const { data: topItems } = useQuery({ queryKey: ["reports", "items"], queryFn: () => reportsApi.topItems(8) });
  const { data: waiters } = useQuery({ queryKey: ["reports", "waiters"], queryFn: reportsApi.waiterPerformance });
  const { data: payments } = useQuery({ queryKey: ["reports", "payments"], queryFn: reportsApi.paymentBreakdown });
  const { data: tables } = useQuery({ queryKey: ["reports", "tables"], queryFn: reportsApi.tableUtilization });

  const totalOrders = revenue?.reduce((s, r) => s + r.orders, 0) ?? 0;
  const totalRevenue = revenue?.reduce((s, r) => s + r.revenue, 0) ?? 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const waiterColumns: Column<WaiterPerformance>[] = [
    { key: "name", header: "Waiter", render: (w) => (
      <div>
        <p className="font-medium text-primary">{w.name}</p>
        <p className="text-xs text-muted">{w.employeeId}</p>
      </div>
    ) },
    { key: "orders", header: "Orders", align: "right", render: (w) => w.orders },
    { key: "revenue", header: "Revenue", align: "right", render: (w) => `₹${w.revenue.toLocaleString("en-IN")}` },
    { key: "avg", header: "Avg. Bill", align: "right", render: (w) => `₹${w.avgBill.toLocaleString("en-IN")}` },
  ];

  const tableColumns: Column<TableUtilization>[] = [
    { key: "number", header: "Table", render: (t) => `Table ${t.number}` },
    { key: "orders", header: "Orders Served", align: "right", render: (t) => t.ordersServed },
    { key: "revenue", header: "Revenue", align: "right", render: (t) => `₹${t.revenue.toLocaleString("en-IN")}` },
  ];

  return (
    <div data-tour-target="reports" className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Revenue, performance, and operational trends."
        actions={
          <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)} wrapperClassName="w-40">
            <option value="day">Last 24 hours</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 12 months</option>
          </Select>
        }
      />

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <SummaryTile label="Total Revenue" value={`₹${totalRevenue.toLocaleString("en-IN")}`} />
        <SummaryTile label="Orders" value={totalOrders} />
        <SummaryTile label="Average Order Value" value={`₹${Math.round(avgOrderValue).toLocaleString("en-IN")}`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue ?? []}>
                  <CartesianGrid vertical={false} stroke="#E7E2D8" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7C76" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7C76" }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E7E2D8", fontSize: 12 }} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#0E9F8E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={payments ?? []} dataKey="total" nameKey="method" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {(payments ?? []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems ?? []} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid horizontal={false} stroke="#E7E2D8" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7C76" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#13302A" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="quantity" fill="#D63A5E" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Waiter Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={waiterColumns} data={waiters ?? []} keyField={(w) => w.waiterId} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Table Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={tableColumns} data={tables ?? []} keyField={(t) => t.tableId} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-borderc bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 font-display text-xl font-bold text-primary">{value}</p>
    </div>
  );
}

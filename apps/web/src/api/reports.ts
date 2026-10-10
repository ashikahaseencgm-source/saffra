import { api } from "./client.js";
import type { DashboardStatsDTO } from "@saffra/types";

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}
export interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}
export interface WaiterPerformance {
  waiterId: string;
  name: string;
  employeeId: string;
  orders: number;
  revenue: number;
  avgBill: number;
}
export interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
}
export interface TableUtilization {
  tableId: string;
  number: number;
  ordersServed: number;
  revenue: number;
}

export const reportsApi = {
  dashboard: () => api.get<DashboardStatsDTO>("/reports/dashboard"),
  revenue: (range: "day" | "week" | "month" | "year" = "week") => api.get<RevenuePoint[]>(`/reports/revenue?range=${range}`),
  topItems: (limit = 10) => api.get<TopItem[]>(`/reports/items?limit=${limit}`),
  waiterPerformance: () => api.get<WaiterPerformance[]>("/reports/waiters"),
  paymentBreakdown: () => api.get<PaymentBreakdown[]>("/reports/payments"),
  tableUtilization: () => api.get<TableUtilization[]>("/reports/tables"),
};

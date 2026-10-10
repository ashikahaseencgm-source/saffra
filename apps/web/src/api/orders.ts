import { api } from "./client.js";
import type { OrderDTO, OrderType } from "@saffra/types";

export interface OrderListResponse {
  data: OrderDTO[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface OrderListQuery {
  status?: string;
  waiterId?: string;
  tableId?: string;
  from?: string;
  to?: string;
  billable?: boolean;
  page?: number;
  pageSize?: number;
}

function toQueryString(query: OrderListQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const ordersApi = {
  list: (query: OrderListQuery = {}) => api.get<OrderListResponse>(`/orders${toQueryString(query)}`),
  get: (id: string) => api.get<OrderDTO>(`/orders/${id}`),
  create: (data: { tableId?: string | null; orderType: OrderType; customerName?: string | null; customerId?: string | null }) =>
    api.post<OrderDTO>("/orders", data),
  update: (id: string, data: { note?: string | null; customerName?: string | null; orderType?: OrderType }) =>
    api.patch<OrderDTO>(`/orders/${id}`, data),
  addItem: (id: string, data: { menuItemId: string; quantity: number; notes?: string | null }) =>
    api.post<OrderDTO>(`/orders/${id}/items`, data),
  updateItem: (id: string, itemId: string, data: { quantity?: number; notes?: string | null }) =>
    api.patch<OrderDTO>(`/orders/${id}/items/${itemId}`, data),
  removeItem: (id: string, itemId: string) => api.delete<OrderDTO>(`/orders/${id}/items/${itemId}`),
  applyDiscount: (id: string, data: { type: "PERCENTAGE" | "FLAT"; value: number; reason: string }) =>
    api.post<OrderDTO>(`/orders/${id}/discount`, data),
  confirm: (id: string) => api.post<OrderDTO>(`/orders/${id}/confirm`),
  sendToKitchen: (id: string) => api.post<OrderDTO>(`/orders/${id}/send-kitchen`),
  serve: (id: string) => api.post<OrderDTO>(`/orders/${id}/serve`),
  complete: (id: string) => api.post<OrderDTO>(`/orders/${id}/complete`),
  cancel: (id: string, reason?: string) => api.post<OrderDTO>(`/orders/${id}/cancel`, { reason }),
  createPaymentLink: (id: string) => api.post<{ token: string }>(`/orders/${id}/payment-link`),
};

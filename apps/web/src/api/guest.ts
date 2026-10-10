import { api } from "./client.js";

// ─── Public (guest phone, no login) ────────────────────────────────────────

export interface GuestMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  foodType: "VEG" | "NON_VEG" | "EGG";
  imageUrl: string | null;
  popular: boolean;
  featured: boolean;
  available: boolean;
}

export interface GuestMenu {
  restaurant: { name: string; logoUrl: string | null; currency: string };
  table: { number: number };
  loyalty: { earnPercent: number; pointValue: number } | null;
  categories: { id: string; name: string; items: GuestMenuItem[] }[];
}

export interface GuestStatus {
  requests: {
    id: string;
    kind: "ORDER" | "BILL";
    status: "PENDING" | "ACCEPTED" | "DECLINED";
    items: { name: string; quantity: number }[];
    declineReason: string | null;
    createdAt: string;
  }[];
  order: {
    status: string;
    items: { name: string; quantity: number; kitchenStatus: "PENDING" | "FIRED" | "SERVED" }[];
    grandTotal: number;
    payLinkToken: string | null;
  } | null;
}

export interface GuestOrderInput {
  items: { menuItemId: string; quantity: number; notes?: string | null }[];
  note?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
}

export const guestApi = {
  menu: (token: string) => api.get<GuestMenu>(`/guest/${token}`, { skipAuth: true }),
  status: (token: string) => api.get<GuestStatus>(`/guest/${token}/status`, { skipAuth: true }),
  placeOrder: (token: string, input: GuestOrderInput) => api.post<{ requestId: string }>(`/guest/${token}/requests`, input, { skipAuth: true }),
  requestBill: (token: string) => api.post<{ requestId: string }>(`/guest/${token}/bill`, undefined, { skipAuth: true }),
};

// ─── Staff ─────────────────────────────────────────────────────────────────

export interface GuestRequestDTO {
  id: string;
  kind: "ORDER" | "BILL";
  tableId: string;
  tableNumber: number;
  items: { menuItemId: string; name: string; price: number; quantity: number; notes: string | null }[];
  note: string | null;
  guestName: string | null;
  guestPhone: string | null;
  estimatedTotal: number;
  createdAt: string;
}

export interface TableQrCode {
  tableId: string;
  number: number;
  capacity: number;
  qrToken: string;
}

export const guestRequestsApi = {
  list: () => api.get<GuestRequestDTO[]>("/guest-requests"),
  accept: (id: string) => api.post<{ requestId: string; orderId: string | null }>(`/guest-requests/${id}/accept`),
  decline: (id: string, reason?: string) => api.post<{ requestId: string }>(`/guest-requests/${id}/decline`, { reason }),
  tableQrCodes: () => api.get<TableQrCode[]>("/guest-requests/table-qr-codes"),
  regenerateQr: (tableId: string) => api.post<TableQrCode>(`/guest-requests/table-qr-codes/${tableId}/regenerate`),
};

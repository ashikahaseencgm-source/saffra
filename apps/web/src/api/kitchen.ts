import { api } from "./client.js";

export interface KitchenTicketDTO {
  id: string;
  ticketNumber: string;
  /** 1 = the table's first order; 2+ = later "more items" rounds on the same bill. */
  round: number;
  status: "NEW" | "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED";
  orderId: string;
  orderNumber: string;
  tableNumber: number | null;
  waiterName: string;
  customerName: string | null;
  items: { name: string; quantity: number; notes: string | null }[];
  note: string | null;
  createdAt: string;
  elapsedMinutes: number;
}

export const kitchenApi = {
  listTickets: () => api.get<KitchenTicketDTO[]>("/kitchen/tickets"),
  advance: (id: string) => api.post<KitchenTicketDTO>(`/kitchen/tickets/${id}/advance`),
  recall: (id: string) => api.post<KitchenTicketDTO>(`/kitchen/tickets/${id}/recall`),
};

import { api } from "./client.js";

export interface CustomerLookupResult {
  found: boolean;
  customer: { id: string; phone: string; name: string; visitCount: number } | null;
  previousOrder: {
    orderNumber: string;
    createdAt: string;
    grandTotal: number;
    items: { name: string; quantity: number }[];
  } | null;
}

export const customersApi = {
  lookup: (phone: string) => api.get<CustomerLookupResult>(`/customers/lookup?phone=${encodeURIComponent(phone)}`),
  create: (phone: string, name: string) => api.post<{ id: string; phone: string; name: string }>("/customers", { phone, name }),
};

import { create } from "zustand";
import type { OrderType } from "@saffra/types";

/**
 * Order-workspace UI state. The cart's actual contents (items, quantities,
 * totals) live server-side and are always fetched/mutated via the orders
 * API + React Query — this store only tracks which table/order the waiter
 * currently has open and the draft fields for a brand-new order, so the
 * billing engine on the server remains the single source of truth for
 * totals.
 */
interface CartState {
  activeTableId: string | null;
  activeOrderId: string | null;
  draftOrderType: OrderType;
  draftCustomerName: string;
  menuSearch: string;
  menuCategory: string | null;
  openWorkspace: (params: { tableId?: string | null; orderId?: string | null }) => void;
  closeWorkspace: () => void;
  setDraftOrderType: (type: OrderType) => void;
  setDraftCustomerName: (name: string) => void;
  setMenuSearch: (q: string) => void;
  setMenuCategory: (category: string | null) => void;
}

export const useCartStore = create<CartState>((set) => ({
  activeTableId: null,
  activeOrderId: null,
  draftOrderType: "DINE_IN",
  draftCustomerName: "",
  menuSearch: "",
  menuCategory: null,
  openWorkspace: ({ tableId, orderId }) =>
    set({ activeTableId: tableId ?? null, activeOrderId: orderId ?? null, menuSearch: "", menuCategory: null }),
  closeWorkspace: () => set({ activeTableId: null, activeOrderId: null, menuSearch: "", menuCategory: null }),
  setDraftOrderType: (draftOrderType) => set({ draftOrderType }),
  setDraftCustomerName: (draftCustomerName) => set({ draftCustomerName }),
  setMenuSearch: (menuSearch) => set({ menuSearch }),
  setMenuCategory: (menuCategory) => set({ menuCategory }),
}));

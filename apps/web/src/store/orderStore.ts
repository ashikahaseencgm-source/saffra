import { create } from "zustand";

interface OrderStoreState {
  lastCompletedOrderId: string | null;
  setLastCompletedOrderId: (id: string | null) => void;
}

export const useOrderStore = create<OrderStoreState>((set) => ({
  lastCompletedOrderId: null,
  setLastCompletedOrderId: (id) => set({ lastCompletedOrderId: id }),
}));

import { api } from "./client.js";
import type { TableDTO, TableStatus } from "@saffra/types";

export const tablesApi = {
  list: () => api.get<TableDTO[]>("/tables"),
  get: (id: string) => api.get<TableDTO>(`/tables/${id}`),
  updateStatus: (id: string, status: TableStatus) => api.patch<TableDTO>(`/tables/${id}/status`, { status }),
  create: (number: number, capacity: number) => api.post<TableDTO>("/tables", { number, capacity }),
  update: (id: string, data: { number?: number; capacity?: number }) => api.patch<TableDTO>(`/tables/${id}`, data),
  remove: (id: string) => api.delete<void>(`/tables/${id}`),
};

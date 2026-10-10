import { api } from "./client.js";
import type { Role } from "@saffra/types";

export interface StaffDTO {
  id: string;
  employeeId: string;
  name: string;
  role: Role;
  phone: string | null;
  email: string | null;
  joiningDate: string;
  active: boolean;
  createdAt: string;
}

export const staffApi = {
  list: () => api.get<StaffDTO[]>("/staff"),
  get: (id: string) => api.get<StaffDTO>(`/staff/${id}`),
  create: (data: { employeeId: string; name: string; role: Role; phone?: string; email?: string; password?: string }) =>
    api.post<StaffDTO>("/staff", data),
  update: (id: string, data: Partial<Pick<StaffDTO, "name" | "role" | "phone" | "email" | "active">>) =>
    api.patch<StaffDTO>(`/staff/${id}`, data),
  resetPassword: (id: string, password: string) => api.post<void>(`/staff/${id}/reset-password`, { password }),
  remove: (id: string) => api.delete<void>(`/staff/${id}`),
};

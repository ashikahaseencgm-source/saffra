import { api } from "./client.js";
import type { MenuItemDTO } from "@saffra/types";

export interface MenuCategoryDTO {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MenuQuery {
  q?: string;
  category?: string;
  foodType?: string;
  available?: boolean;
  popular?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

function toQueryString(query: MenuQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const menuApi = {
  list: (query: MenuQuery = {}) => api.get<MenuItemDTO[]>(`/menu${toQueryString(query)}`),
  categories: () => api.get<MenuCategoryDTO[]>("/menu/categories"),
  createCategory: (name: string, sortOrder = 0) => api.post<MenuCategoryDTO>("/menu/categories", { name, sortOrder }),
  get: (id: string) => api.get<MenuItemDTO>(`/menu/${id}`),
  create: (data: Partial<MenuItemDTO>) => api.post<MenuItemDTO>("/menu", data),
  update: (id: string, data: Partial<MenuItemDTO>) => api.patch<MenuItemDTO>(`/menu/${id}`, data),
  remove: (id: string) => api.delete<void>(`/menu/${id}`),
};

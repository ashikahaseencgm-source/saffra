import { api } from "./client.js";
import type { AuthUserDTO } from "@saffra/types";

export interface LoginResponse {
  user: AuthUserDTO;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: (employeeId: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { employeeId, password }, { skipAuth: true }),
  logout: (refreshToken: string) => api.post<void>("/auth/logout", { refreshToken }),
  me: () => api.get<AuthUserDTO>("/auth/me"),
  completeTour: () => api.post<AuthUserDTO>("/auth/complete-tour"),
};

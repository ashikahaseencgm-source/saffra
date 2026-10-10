import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUserDTO } from "@saffra/types";

interface AuthState {
  user: AuthUserDTO | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (session: { user: AuthUserDTO; accessToken: string; refreshToken: string }) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: AuthUserDTO) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: "saffra-auth" },
  ),
);

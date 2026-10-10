import { api } from "./client.js";
import type { AuthUserDTO } from "@saffra/types";

export interface SetupStatus {
  needsOnboarding: boolean;
}

export interface NetworkInfo {
  addresses: string[];
  port: number;
  /** e.g. "spice-garden.local" */
  hostname: string | null;
  /** Easy-to-type address, e.g. http://spice-garden.local; null if the name service isn't running. */
  nameUrl: string | null;
  /** Numeric address that works on every device (what QR codes point at); null if not on a network. */
  ipUrl: string | null;
}

export interface CompleteSetupInput {
  restaurant: {
    name: string;
    address?: string | null;
    city?: string | null;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  tax: { cgstPercent: number; sgstPercent: number; serviceChargePercent: number };
  admin: { name: string; employeeId: string; password: string };
  tableCount: number;
  loadSampleMenu: boolean;
}

export interface CompleteSetupResponse {
  user: AuthUserDTO;
  accessToken: string;
  refreshToken: string;
}

export const setupApi = {
  status: () => api.get<SetupStatus>("/setup/status", { skipAuth: true }),
  networkInfo: () => api.get<NetworkInfo>("/setup/network-info", { skipAuth: true }),
  complete: (input: CompleteSetupInput) => api.post<CompleteSetupResponse>("/setup/complete", input, { skipAuth: true }),
};

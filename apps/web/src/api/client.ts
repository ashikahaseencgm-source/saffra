import { useAuthStore } from "../store/authStore.js";

// Relative by default: the API is served from the same origin as the page
// (single Express server, single port). That's what makes it work
// unmodified whether the page loads as http://localhost:4000 on the host
// machine or http://192.168.1.42:4000 from a waiter's phone over Wi-Fi —
// there's no hardcoded host to be wrong on a different device. Only set
// VITE_API_BASE_URL for a dev setup where the frontend and API run on two
// different ports/origins (Vite dev server + API dev server).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAccessToken, clear } = useAuthStore.getState();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          clear();
          return null;
        }
        const data = await res.json();
        setAccessToken(data.accessToken);
        useAuthStore.setState({ refreshToken: data.refreshToken });
        return data.accessToken as string;
      })
      .catch(() => {
        clear();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
  responseType?: "json" | "blob" | "text";
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, responseType = "json", headers, ...rest } = options;
  const token = useAuthStore.getState().accessToken;

  const doFetch = async (accessToken: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken && !skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch(token);

  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let code: string | undefined;
    let details: unknown;
    try {
      const data = await res.json();
      message = data?.error?.message ?? message;
      code = data?.error?.code;
      details = data?.error?.details;
    } catch {
      // response wasn't JSON
    }
    throw new ApiError(res.status, message, code, details);
  }

  if (res.status === 204) return undefined as T;
  if (responseType === "blob") return (await res.blob()) as T;
  if (responseType === "text") return (await res.text()) as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: "DELETE" }),
};

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { AuthResponse, AuthUserInfo, ApiError } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const AUTH_EVENT_NAME = "freightflow-auth-changed";

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// ==================== Token management ====================

const TOKEN_KEY = "freightflow_access_token";
const REFRESH_KEY = "freightflow_refresh_token";
const USER_KEY = "freightflow_user";
let refreshRequest: Promise<AuthResponse> | null = null;
let loginRedirectPending = false;

type AuthEventReason =
  | "login"
  | "logout"
  | "refresh"
  | "refresh_failed"
  | "unauthorized"
  | "forbidden";

export interface AuthEventDetail {
  type: "saved" | "cleared" | "forbidden";
  reason: AuthEventReason;
}

function dispatchAuthEvent(detail: AuthEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthEventDetail>(AUTH_EVENT_NAME, { detail }));
}

function redirectToLogin(): void {
  if (typeof window === "undefined" || loginRedirectPending) return;
  if (window.location.pathname === "/login") return;
  loginRedirectPending = true;
  window.location.href = "/login";
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUserInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAuth(
  auth: AuthResponse,
  options: { reason?: Extract<AuthEventReason, "login" | "refresh"> } = {}
): void {
  localStorage.setItem(TOKEN_KEY, auth.accessToken);
  localStorage.setItem(REFRESH_KEY, auth.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  loginRedirectPending = false;
  dispatchAuthEvent({ type: "saved", reason: options.reason || "login" });
}

export function clearAuth(
  options: { reason?: Extract<AuthEventReason, "logout" | "refresh_failed" | "unauthorized"> } = {}
): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  dispatchAuthEvent({ type: "cleared", reason: options.reason || "logout" });
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// ==================== Interceptors ====================

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const requestUrl = originalRequest?.url || "";

    if (error.response?.status === 403) {
      dispatchAuthEvent({ type: "forbidden", reason: "forbidden" });
      return Promise.reject(error);
    }

    // Tenta refresh se receber 401 e não for retry
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      getRefreshToken() &&
      !requestUrl.includes("/auth/login") &&
      !requestUrl.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshRequest) {
          const refreshToken = getRefreshToken();
          refreshRequest = axios
            .post<AuthResponse>(`${API_URL}/api/v1/auth/refresh`, { refreshToken })
            .then((response) => response.data)
            .finally(() => {
              refreshRequest = null;
            });
        }

        const refreshedAuth = await refreshRequest;

        saveAuth(refreshedAuth, { reason: "refresh" });
        originalRequest.headers.Authorization = `Bearer ${refreshedAuth.accessToken}`;
        return api(originalRequest);
      } catch {
        clearAuth({ reason: "refresh_failed" });
        redirectToLogin();
      }
    }

    if (error.response?.status === 401) {
      clearAuth({ reason: "unauthorized" });
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export default api;

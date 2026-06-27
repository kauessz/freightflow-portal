"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import api, {
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveAuth,
  clearAuth,
  AUTH_EVENT_NAME,
  type AuthEventDetail,
} from "@/lib/api";
import { ApiError, AuthResponse, AuthUserInfo, LoginRequest } from "@/types";

interface AuthContextValue {
  user: AuthUserInfo | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  logout: (redirectTo?: string) => void;
  refreshSession: () => Promise<AuthResponse | null>;
  loadStoredSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function syncStoredSession() {
  return {
    user: getStoredUser(),
    accessToken: getAccessToken(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserInfo | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStoredSession = useCallback(() => {
    const session = syncStoredSession();
    setUser(session.user);
    setAccessToken(session.accessToken);
  }, []);

  useEffect(() => {
    loadStoredSession();
    setIsLoading(false);
  }, [loadStoredSession]);

  useEffect(() => {
    function handleAuthChange(event: Event) {
      const detail = (event as CustomEvent<AuthEventDetail>).detail;
      loadStoredSession();
      if (
        detail?.type === "cleared" &&
        detail.reason !== "logout" &&
        typeof window !== "undefined" &&
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/track"
      ) {
        router.replace("/login");
      }
    }

    window.addEventListener(AUTH_EVENT_NAME, handleAuthChange as EventListener);
    return () => {
      window.removeEventListener(
        AUTH_EVENT_NAME,
        handleAuthChange as EventListener
      );
    };
  }, [loadStoredSession, router]);

  const login = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await api.post<AuthResponse>("/auth/login", credentials);
      saveAuth(response.data, { reason: "login" });
      loadStoredSession();
      return response.data;
    } catch (error) {
      throw error as AxiosError<ApiError>;
    } finally {
      setIsLoading(false);
    }
  }, [loadStoredSession]);

  const logout = useCallback(
    (redirectTo = "/login") => {
      clearAuth({ reason: "logout" });
      setUser(null);
      setAccessToken(null);
      router.replace(redirectTo);
    },
    [router]
  );

  const refreshSession = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    setIsLoading(true);
    try {
      const response = await api.post<AuthResponse>("/auth/refresh", {
        refreshToken,
      });
      saveAuth(response.data, { reason: "refresh" });
      loadStoredSession();
      return response.data;
    } finally {
      setIsLoading(false);
    }
  }, [loadStoredSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!accessToken,
      isLoading,
      login,
      logout,
      refreshSession,
      loadStoredSession,
    }),
    [accessToken, isLoading, loadStoredSession, login, logout, refreshSession, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

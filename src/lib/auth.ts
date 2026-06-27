import api, { saveAuth, clearAuth } from "./api";
import { AuthResponse, LoginRequest } from "@/types";

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/login", credentials);
  saveAuth(response.data, { reason: "login" });
  return response.data;
}

export async function logout(): Promise<void> {
  clearAuth({ reason: "logout" });
}

export async function refreshToken(token: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/refresh", {
    refreshToken: token,
  });
  saveAuth(response.data, { reason: "refresh" });
  return response.data;
}

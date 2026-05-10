import { apiFetch, setApiAuthToken } from "./api";

export type CurrentUser = {
  id: string;
  email: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
};

export type AuthResponse = {
  token: string;
  user: CurrentUser;
};

export async function login(identifier: string, password: string) {
  const response = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  setApiAuthToken(response.token);
  return response;
}

export async function signup(input: {
  username: string;
  email: string;
  displayName: string;
  password: string;
}) {
  const response = await apiFetch<AuthResponse>("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  setApiAuthToken(response.token);
  return response;
}

export async function logout() {
  await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => ({ ok: false }));
  setApiAuthToken(null);
}

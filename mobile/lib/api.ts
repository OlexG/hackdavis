// Resolves the base URL for the Sunpatch Next.js API at runtime.
//
// Priority:
//   1. EXPO_PUBLIC_API_BASE env var (set in `.env` or shell when starting Expo).
//   2. Expo dev server host (so phone + emulator just work in development).
//   3. http://localhost:3000 fallback for web.
import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_PORT = 3000;
let authToken: string | null = null;

function resolveDevHost(): string | null {
  const hostUri =
    (Constants.expoConfig as { hostUri?: string } | undefined)?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    null;

  if (!hostUri) {
    return null;
  }

  const host = hostUri.split(":")[0];

  // Android emulator can't reach the host's localhost via 127.0.0.1.
  if (Platform.OS === "android" && (host === "localhost" || host === "127.0.0.1")) {
    return "10.0.2.2";
  }

  return host;
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE;

  if (fromEnv && fromEnv.trim().length) {
    return fromEnv.replace(/\/+$/, "");
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Same-origin works when the Next.js app proxies the Expo web build,
    // otherwise fall back to localhost:3000.
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${DEFAULT_PORT}`;
  }

  const devHost = resolveDevHost();

  if (devHost) {
    return `http://${devHost}:${DEFAULT_PORT}`;
  }

  return `http://localhost:${DEFAULT_PORT}`;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function setApiAuthToken(token: string | null) {
  authToken = token;
}

export function getApiAuthToken() {
  return authToken;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init?.headers);

  headers.set("Accept", "application/json");
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network error";
    throw new ApiError(`Could not reach ${url}: ${reason}`, 0);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiError(
      `Request to ${url} failed (${response.status}): ${body.slice(0, 200)}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

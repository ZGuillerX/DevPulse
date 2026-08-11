const API_BASE = "/api";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("devpulse:token");
}

function getAiKey(): string | null {
  return localStorage.getItem("devpulse:aiKey");
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  skipAiKey?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const aiKey = getAiKey();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (aiKey && !options.skipAiKey) headers["x-ai-key"] = aiKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data?.error?.message || `Error ${res.status}`,
      data?.error?.code || "UNKNOWN_ERROR",
      res.status
    );
  }

  return data as T;
}

export function setAuthToken(token: string) {
  localStorage.setItem("devpulse:token", token);
}

export function clearAuthToken() {
  localStorage.removeItem("devpulse:token");
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function setAiKey(key: string) {
  localStorage.setItem("devpulse:aiKey", key);
}

export function getStoredAiKey(): string {
  return localStorage.getItem("devpulse:aiKey") || "";
}

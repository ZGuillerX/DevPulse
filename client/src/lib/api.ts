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

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  skipAiKey?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!options.skipAiKey) {
    const aiKeys = getStoredAiKeys();
    if (Object.keys(aiKeys).length > 0) headers["x-ai-keys"] = JSON.stringify(aiKeys);
  }

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

// Expuesto (a diferencia de getToken) para que useNotifications pueda armar
// la URL del WebSocket, que no puede llevar un header Authorization.
export function getAuthToken(): string | null {
  return getToken();
}

export type AiProvider = "groq" | "openai" | "anthropic";

const AI_KEYS_STORAGE_KEY = "devpulse:aiKeys";

export function getStoredAiKeys(): Partial<Record<AiProvider, string>> {
  try {
    return JSON.parse(localStorage.getItem(AI_KEYS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setStoredAiKeys(keys: Partial<Record<AiProvider, string>>) {
  const cleaned = Object.fromEntries(Object.entries(keys).filter(([, v]) => Boolean(v)));
  localStorage.setItem(AI_KEYS_STORAGE_KEY, JSON.stringify(cleaned));
}

export function getPreferredAiProvider(): AiProvider {
  return (localStorage.getItem("devpulse:aiProvider") as AiProvider) || "groq";
}

export function setPreferredAiProvider(provider: AiProvider) {
  localStorage.setItem("devpulse:aiProvider", provider);
}

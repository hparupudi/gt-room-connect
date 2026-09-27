// Same origin by default, which is what the Vite proxy in dev and a single-host
// deploy both expect. Set VITE_API_URL when Flask answers somewhere else.
const BASE = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

/** Resolves an API path against the configured backend. Absolute URLs pass through. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(apiUrl(path), { ...options, headers });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new ApiError(data.error || "Something went wrong.", response.status);
  }
  return data as T;
}

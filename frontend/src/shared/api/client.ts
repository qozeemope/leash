export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const NETWORK_MESSAGE =
  "The server could not be reached. The connection may be down or the server may be restarting. Check the connection and try again.";
const GENERIC_MESSAGE =
  "The request could not be completed. The server returned an unexpected response. Try again in a moment.";

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return null;
}

async function csrfToken(): Promise<string | null> {
  const existing = readCookie("csrftoken");
  if (existing) return existing;
  try {
    await fetch("/api/auth/csrf/", { credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "network_error", NETWORK_MESSAGE);
  }
  return readCookie("csrftoken");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toApiError(status: number, payload: unknown): ApiError {
  if (isRecord(payload) && isRecord(payload.error)) {
    const { code, message, details } = payload.error;
    return new ApiError(
      status,
      typeof code === "string" ? code : "error",
      typeof message === "string" ? message : GENERIC_MESSAGE,
      details,
    );
  }
  return new ApiError(status, "error", GENERIC_MESSAGE);
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };

  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (!SAFE_METHODS.has(method)) {
    const token = await csrfToken();
    if (token) headers["X-CSRFToken"] = token;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      signal: options.signal,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_error", NETWORK_MESSAGE);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) throw toApiError(response.status, payload);
  return payload as T;
}

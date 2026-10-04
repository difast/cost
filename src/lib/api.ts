"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
    location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
  }
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Ошибка ${res.status}`, data?.details);
  return data as T;
}

export const api = {
  get: <T>(url: string) => fetch(url, { cache: "no-store" }).then(handle<T>),
  post: <T>(url: string, body?: unknown) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }).then(handle<T>),
  put: <T>(url: string, body: unknown) =>
    fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(handle<T>),
  patch: <T>(url: string, body: unknown) =>
    fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(handle<T>),
  del: <T>(url: string) => fetch(url, { method: "DELETE" }).then(handle<T>),
  upload: <T>(url: string, form: FormData) => fetch(url, { method: "POST", body: form }).then(handle<T>),
};

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const det = Array.isArray(e.details)
      ? (e.details as Array<{ path?: string; message?: string }>).slice(0, 5).map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join("; ")
      : "";
    return det ? `${e.message}: ${det}` : e.message;
  }
  return e instanceof Error ? e.message : "Неизвестная ошибка";
}

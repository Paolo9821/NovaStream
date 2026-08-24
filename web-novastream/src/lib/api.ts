export const API_BASE = "https://crea-un-applicazione-di-iptv-che-accetta-backend.rork.app";

export type PlanId = "annual" | "lifetime";

export type PlanInfo = {
  id: PlanId;
  label: string;
  price: string;
  priceCents: number;
  durationDays: number | null;
};

export type StoreConfig = {
  provider: "stripe";
  paymentsConfigured: boolean;
  mode: "live" | "test";
  currency: string;
  plans: PlanInfo[];
};

export type CheckoutResult = {
  ok: boolean;
  error?: string;
  deviceId?: string;
  plan?: PlanId;
  expiresAt?: number | null;
};

export type DeviceStatus = {
  found: boolean;
  status: "active" | "suspended" | "revoked" | "expired" | "none";
  plan: string;
  expiresAt: number | null;
  note: string;
  serverTime: number;
};

export type LicenseRecord = {
  deviceId: string;
  status: "active" | "suspended" | "revoked";
  plan: string;
  email: string;
  label: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  lastSeenAt: number | null;
  orderId: string;
  amountCents: number;
  source: string;
  expired: boolean;
};

export type RegistryStats = {
  total: number;
  active: number;
  suspended: number;
  revoked: number;
  expired: number;
  revenueCents: number;
  revenueCents30d: number;
};

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

export function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  return call<T>(path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export const fetchConfig = (): Promise<StoreConfig> => call<StoreConfig>("/api/config");

export const fetchDeviceStatus = (deviceId: string): Promise<DeviceStatus> =>
  post<DeviceStatus>("/api/license/status", { deviceId });

/** Opens a hosted Stripe Checkout page; price and device binding stay server-side. */
export const startCheckout = (
  plan: PlanId,
  deviceId: string,
  email: string,
): Promise<{ id: string; url: string }> =>
  post<{ id: string; url: string }>("/api/checkout/create-session", { plan, deviceId, email });

export const confirmCheckout = (sessionId: string): Promise<CheckoutResult> =>
  post<CheckoutResult>("/api/checkout/confirm", { sessionId });

/** Folds a typed MAC into the canonical form the registry stores. */
export function normalizeDeviceId(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidDeviceId(raw: string): boolean {
  const normalized = normalizeDeviceId(raw);
  return /^[A-F0-9]{12}$/.test(normalized) || /^[A-Z0-9]{8,32}$/.test(normalized);
}

export function formatMac(raw: string): string {
  const normalized = normalizeDeviceId(raw);
  if (!/^[A-F0-9]{12}$/.test(normalized)) return normalized;
  return normalized.match(/.{1,2}/g)?.join(":") ?? normalized;
}

export function formatDate(ms: number | null, locale = "it-IT"): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(ms: number | null, locale = "it-IT"): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

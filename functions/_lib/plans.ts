/** Catalogue of what NovaStream sells. Prices are authoritative server-side. */
export type PlanId = "annual" | "lifetime";

export type Plan = {
  id: PlanId;
  label: string;
  priceCents: number;
  currency: "EUR";
  durationDays: number | null;
};

export const PLANS: Record<PlanId, Plan> = {
  annual: {
    id: "annual",
    label: "12 months",
    priceCents: 399,
    currency: "EUR",
    durationDays: 365,
  },
  lifetime: {
    id: "lifetime",
    label: "Lifetime",
    priceCents: 1299,
    currency: "EUR",
    durationDays: null,
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "annual" || value === "lifetime";
}

export function priceString(plan: Plan): string {
  return (plan.priceCents / 100).toFixed(2);
}

/**
 * Device ids arrive from three places (the app, a customer typing a MAC by hand,
 * the dashboard) so they are folded to one canonical shape before storage.
 */
export function normalizeDeviceId(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** A MAC (12 hex) or an ANDROID_ID (16 hex) — anything else is a typo. */
export function isValidDeviceId(normalized: string): boolean {
  return /^[A-F0-9]{12}$/.test(normalized) || /^[A-Z0-9]{8,32}$/.test(normalized);
}

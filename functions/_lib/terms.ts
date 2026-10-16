/**
 * How long a licence lasts when it is not simply bought from the store:
 * granted by hand in the dashboard or unlocked with a gift code.
 */
export type Term =
  | { kind: "months"; months: number }
  | { kind: "days"; days: number }
  | { kind: "lifetime" }
  | { kind: "date"; expiresAt: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest custom duration accepted, to catch typos like 3650 vs 365. */
const MAX_DAYS = 3650;

/** Parses a term sent by the dashboard or kept in a promo code; null when unusable. */
export function readTerm(raw: unknown): Term | null {
  if (typeof raw === "string") {
    try {
      return readTerm(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  const input = (raw ?? {}) as Record<string, unknown>;
  switch (input.kind) {
    case "lifetime":
      return { kind: "lifetime" };
    case "months": {
      const months = Math.round(Number(input.months));
      return Number.isFinite(months) && months >= 1 && months <= 120 ? { kind: "months", months } : null;
    }
    case "days": {
      const days = Math.round(Number(input.days));
      return Number.isFinite(days) && days >= 1 && days <= MAX_DAYS ? { kind: "days", days } : null;
    }
    case "date": {
      const expiresAt = Number(input.expiresAt);
      return Number.isFinite(expiresAt) && expiresAt > Date.now() && expiresAt < Date.now() + MAX_DAYS * DAY_MS
        ? { kind: "date", expiresAt }
        : null;
    }
    default:
      return null;
  }
}

/** Short label kept on the licence so the dashboard can say "3 mesi" instead of a raw date. */
export function termCode(term: Term): string {
  switch (term.kind) {
    case "lifetime":
      return "lifetime";
    case "months":
      return `${term.months}m`;
    case "days":
      return `${term.days}d`;
    case "date":
      return "date";
  }
}

/** Adds calendar months, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb). */
function addMonths(base: number, months: number): number {
  const date = new Date(base);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}

/**
 * Expiry produced by a term. `base` is where the time starts counting: the
 * current expiry when it is still running (so nothing already paid is lost),
 * otherwise now. A fixed date ignores it.
 */
export function expiryFor(term: Term, base: number): number | null {
  switch (term.kind) {
    case "lifetime":
      return null;
    case "months":
      return addMonths(base, term.months);
    case "days":
      return base + term.days * DAY_MS;
    case "date":
      return term.expiresAt;
  }
}

import type { LicenseRecord, PromoCode, Term } from "@/lib/api";

/** Owner-facing (Italian) label for a licence duration code kept by the server. */
export function termCodeLabel(code: string): string {
  if (code === "lifetime") return "A vita";
  if (code === "date") return "Data scelta";
  const months = /^(\d+)m$/.exec(code);
  if (months) return Number(months[1]) === 1 ? "1 mese" : `${months[1]} mesi`;
  const days = /^(\d+)d$/.exec(code);
  if (days) return Number(days[1]) === 1 ? "1 giorno" : `${days[1]} giorni`;
  return code || "—";
}

/** Same, for a duration object (gift codes, pickers). */
export function termLabel(term: Term | null): string {
  if (!term) return "—";
  switch (term.kind) {
    case "lifetime":
      return "A vita";
    case "months":
      return term.months === 1 ? "1 mese" : `${term.months} mesi`;
    case "days":
      return term.days === 1 ? "1 giorno" : `${term.days} giorni`;
    case "date":
      return `Fino al ${new Date(term.expiresAt).toLocaleDateString("it-IT")}`;
  }
}

/** Where the licence came from, in plain words. */
export function sourceLabel(source: string): string {
  switch (source) {
    case "stripe":
      return "Acquisto";
    case "manual":
      return "Manuale";
    case "gift":
      return "Codice regalo";
    default:
      return source;
  }
}

export type LicenseState = "active" | "expired" | "suspended" | "revoked";

export function licenseState(row: LicenseRecord): LicenseState {
  return row.status === "active" && row.expired ? "expired" : row.status;
}

export type CodeState = "active" | "disabled" | "expired" | "usedUp";

export function codeState(code: PromoCode): CodeState {
  if (!code.active) return "disabled";
  if (code.expiresAt !== null && code.expiresAt < Date.now()) return "expired";
  if (code.maxUses > 0 && code.usedCount >= code.maxUses) return "usedUp";
  return "active";
}

/** "−20%", "−€ 1,00" or the gift's duration. */
export function codeValueLabel(code: PromoCode): string {
  if (code.kind === "percent") return `−${code.value}%`;
  if (code.kind === "amount") return `−€ ${(code.value / 100).toFixed(2).replace(".", ",")}`;
  return termLabel(code.term);
}

/** Public address of the store, used for shareable gift links. */
export const STORE_ORIGIN = "https://novastreamapp.com";

export const giftLink = (code: string): string => `${STORE_ORIGIN}/?code=${encodeURIComponent(code)}`;

/** End of the given local calendar day (yyyy-mm-dd), as a timestamp. */
export function endOfDay(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/** Today + n days as yyyy-mm-dd, for date input minimums and defaults. */
export function isoDay(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Client-side preview of an expiry, mirroring the server's calendar maths. */
export function previewExpiry(term: Term | null, base = Date.now()): number | null | undefined {
  if (!term) return undefined;
  switch (term.kind) {
    case "lifetime":
      return null;
    case "date":
      return term.expiresAt;
    case "days":
      return base + term.days * 86_400_000;
    case "months": {
      const date = new Date(base);
      const day = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + term.months);
      const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(day, last));
      return date.getTime();
    }
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

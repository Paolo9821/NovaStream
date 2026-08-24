import { PLANS, priceString, type PlanId } from "./plans";

export type StripeEnv = {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET?: string;
};

const API = "https://api.stripe.com/v1";

export function stripeConfigured(env: StripeEnv): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim().startsWith("sk_"));
}

/** Test keys are `sk_test_…`; anything else live is treated as real money. */
export function stripeMode(env: StripeEnv): "live" | "test" {
  return env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_") ? "test" : "live";
}

async function stripeFetch<T>(
  env: StripeEnv,
  path: string,
  init: { method: "GET" | "POST"; body?: URLSearchParams; idempotencyKey?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY.trim()}`,
  };
  if (init.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  const response = await fetch(`${API}${path}`, {
    method: init.method,
    headers,
    body: init.body?.toString(),
  });
  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `stripe request failed (${response.status})`);
  }
  return payload;
}

export type CheckoutSession = {
  id: string;
  paid: boolean;
  amountTotal: number;
  currency: string;
  deviceId: string;
  plan: string;
  email: string;
};

type RawSession = {
  id?: string;
  payment_status?: string;
  status?: string;
  amount_total?: number;
  currency?: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
  customer_details?: { email?: string | null };
  customer_email?: string | null;
};

function readSession(raw: RawSession): CheckoutSession {
  return {
    id: raw.id ?? "",
    paid: raw.payment_status === "paid" || raw.payment_status === "no_payment_required",
    amountTotal: raw.amount_total ?? 0,
    currency: (raw.currency ?? "").toUpperCase(),
    deviceId: raw.metadata?.deviceId ?? raw.client_reference_id ?? "",
    plan: raw.metadata?.plan ?? "",
    email: raw.customer_details?.email ?? raw.customer_email ?? "",
  };
}

/**
 * Creates a hosted Stripe Checkout session. The price and the device binding
 * live server-side so a customer can never rewrite either from the browser.
 */
export async function createCheckoutSession(
  env: StripeEnv,
  planId: PlanId,
  deviceId: string,
  email: string,
  storeUrl: string,
): Promise<{ id: string; url: string }> {
  const plan = PLANS[planId];
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": plan.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(plan.priceCents),
    "line_items[0][price_data][product_data][name]": `NovaStream · ${plan.label}`,
    "line_items[0][price_data][product_data][description]": `Licenza per il dispositivo ${deviceId}`,
    // Required by Stripe Managed Payments: prewritten software downloaded for personal use.
    "line_items[0][price_data][product_data][tax_code]": "txcd_10202000",
    // The advertised price is the final price: VAT is carved out of it instead of
    // added on top, so the buyer pays exactly what the storefront showed.
    "line_items[0][price_data][tax_behavior]": "inclusive",
    client_reference_id: deviceId,
    "metadata[deviceId]": deviceId,
    "metadata[plan]": planId,
    "payment_intent_data[metadata][deviceId]": deviceId,
    "payment_intent_data[metadata][plan]": planId,
    "payment_intent_data[description]": `NovaStream ${plan.label} — ${deviceId}`,
    success_url: `${storeUrl}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${storeUrl}/?checkout=cancelled`,
    locale: "auto",
  });
  if (email) body.set("customer_email", email);

  const session = await stripeFetch<RawSession & { url?: string }>(env, "/checkout/sessions", {
    method: "POST",
    body,
    idempotencyKey: `novastream-${deviceId}-${planId}-${priceString(plan)}-${Date.now()}`,
  });
  if (!session.id || !session.url) throw new Error("stripe returned an incomplete session");
  return { id: session.id, url: session.url };
}

export async function getCheckoutSession(env: StripeEnv, sessionId: string): Promise<CheckoutSession> {
  const raw = await stripeFetch<RawSession>(env, `/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
  });
  return readSession(raw);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Verifies the `Stripe-Signature` header (scheme v1: HMAC-SHA256 over
 * `timestamp.payload`) and rejects replays older than five minutes.
 */
export async function verifyWebhook(
  secret: string,
  payload: string,
  header: string | null,
): Promise<boolean> {
  if (!secret || !header) return false;
  const parts = new Map<string, string[]>();
  for (const chunk of header.split(",")) {
    const [key, value] = chunk.split("=", 2);
    if (!key || !value) continue;
    const list = parts.get(key.trim()) ?? [];
    list.push(value.trim());
    parts.set(key.trim(), list);
  }
  const timestamp = parts.get("t")?.[0];
  const signatures = parts.get("v1") ?? [];
  if (!timestamp || signatures.length === 0) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)),
  );
  return signatures.some((signature) => {
    if (!/^[a-f0-9]+$/i.test(signature) || signature.length !== digest.length * 2) return false;
    return timingSafeEqual(digest, hexToBytes(signature));
  });
}

export { readSession };
export type { RawSession };

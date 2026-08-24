import { PLANS, priceString, type PlanId } from "./plans";

export type PayPalEnv = {
  PAYPAL_CLIENT_ID: string;
  PAYPAL_SECRET: string;
  PAYPAL_MODE?: string;
};

export function payPalBase(env: PayPalEnv): string {
  return env.PAYPAL_MODE?.trim().toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function payPalConfigured(env: PayPalEnv): boolean {
  return Boolean(env.PAYPAL_CLIENT_ID?.trim() && env.PAYPAL_SECRET?.trim());
}

async function accessToken(env: PayPalEnv): Promise<string> {
  const credentials = btoa(`${env.PAYPAL_CLIENT_ID.trim()}:${env.PAYPAL_SECRET.trim()}`);
  const response = await fetch(`${payPalBase(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error(`paypal auth failed (${response.status})`);
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("paypal auth returned no token");
  return payload.access_token;
}

export type PayPalOrder = {
  id: string;
  status: string;
  amountValue: string;
  currency: string;
  customId: string;
  payerEmail: string;
};

function readOrder(raw: unknown): PayPalOrder {
  const order = raw as {
    id?: string;
    status?: string;
    payer?: { email_address?: string };
    purchase_units?: {
      custom_id?: string;
      amount?: { value?: string; currency_code?: string };
      payments?: {
        captures?: { amount?: { value?: string; currency_code?: string }; status?: string }[];
      };
    }[];
  };
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    id: order.id ?? "",
    status: capture?.status ?? order.status ?? "UNKNOWN",
    amountValue: capture?.amount?.value ?? unit?.amount?.value ?? "0",
    currency: capture?.amount?.currency_code ?? unit?.amount?.currency_code ?? "",
    customId: unit?.custom_id ?? "",
    payerEmail: order.payer?.email_address ?? "",
  };
}

export async function createOrder(
  env: PayPalEnv,
  planId: PlanId,
  deviceId: string,
): Promise<{ id: string }> {
  const plan = PLANS[planId];
  const token = await accessToken(env);
  const response = await fetch(`${payPalBase(env)}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: `${deviceId}|${planId}`,
          description: `NovaStream ${plan.label}`,
          amount: { currency_code: plan.currency, value: priceString(plan) },
        },
      ],
      application_context: {
        brand_name: "NovaStream",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    }),
  });
  const payload = (await response.json()) as { id?: string; message?: string };
  if (!response.ok || !payload.id) {
    throw new Error(payload.message ?? `paypal order failed (${response.status})`);
  }
  return { id: payload.id };
}

export async function captureOrder(env: PayPalEnv, orderId: string): Promise<PayPalOrder> {
  const token = await accessToken(env);
  const response = await fetch(`${payPalBase(env)}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `novastream-${orderId}`,
    },
  });
  const raw = await response.json();
  if (!response.ok) {
    // Already captured (e.g. a retried tab) — read the authoritative order instead.
    const issue = (raw as { details?: { issue?: string }[] }).details?.[0]?.issue;
    if (issue === "ORDER_ALREADY_CAPTURED") return getOrder(env, orderId);
    const message = (raw as { message?: string }).message ?? `capture failed (${response.status})`;
    throw new Error(message);
  }
  return readOrder(raw);
}

export async function getOrder(env: PayPalEnv, orderId: string): Promise<PayPalOrder> {
  const token = await accessToken(env);
  const response = await fetch(`${payPalBase(env)}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await response.json();
  if (!response.ok) {
    const message = (raw as { message?: string }).message ?? `order lookup failed (${response.status})`;
    throw new Error(message);
  }
  return readOrder(raw);
}

import { issueToken, passwordMatches, verifyToken } from "./_lib/auth";
import {
  captureOrder,
  createOrder,
  getOrder,
  payPalConfigured,
  type PayPalEnv,
} from "./_lib/paypal";
import { PLANS, isPlanId, isValidDeviceId, normalizeDeviceId, priceString } from "./_lib/plans";

export { Registry } from "./registry";

type Env = PayPalEnv & {
  DO: Fetcher;
  ADMIN_PASSWORD: string;
  STORE_URL?: string;
};

/** Where the app sends customers to buy. Overridable without an app update. */
const DEFAULT_STORE_URL = "https://y3r8htb0dd0n4d7e25ikz-web-novastream.rork.live";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Every registry read/write funnels through the single global Durable Object. */
async function registry(env: Env, path: string, body: unknown): Promise<Response> {
  const request = new Request(`https://internal${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Rork-DO-Class": "Registry",
      "X-Rork-DO-Id": "global",
    },
    body: JSON.stringify(body ?? {}),
  });
  return env.DO.fetch(request);
}

async function registryJson<T>(env: Env, path: string, body: unknown): Promise<T> {
  const response = await registry(env, path, body);
  return (await response.json()) as T;
}

async function requireAdmin(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  return verifyToken(env.ADMIN_PASSWORD, token);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/" || path === "/api/health") {
        return json({ ok: true, service: "novastream-licenses" });
      }

      if (path === "/api/config") {
        return json({
          paypalConfigured: payPalConfigured(env),
          paypalClientId: payPalConfigured(env) ? env.PAYPAL_CLIENT_ID.trim() : "",
          mode: env.PAYPAL_MODE?.trim().toLowerCase() === "live" ? "live" : "sandbox",
          currency: "EUR",
          storeUrl: env.STORE_URL?.trim() || DEFAULT_STORE_URL,
          plans: Object.values(PLANS).map((plan) => ({
            id: plan.id,
            label: plan.label,
            price: priceString(plan),
            priceCents: plan.priceCents,
            durationDays: plan.durationDays,
          })),
        });
      }

      // ---- App-facing ----------------------------------------------------
      if (path === "/api/license/status" && request.method === "POST") {
        const body = await readBody(request);
        const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
        if (!deviceId) return fail("deviceId required");
        const result = await registryJson<Record<string, unknown>>(env, "/status", { deviceId });
        return json(result);
      }

      // ---- Checkout ------------------------------------------------------
      if (path === "/api/checkout/create-order" && request.method === "POST") {
        if (!payPalConfigured(env)) return fail("payments not configured", 503);
        const body = await readBody(request);
        const planId = String(body.plan ?? "");
        const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
        if (!isPlanId(planId)) return fail("unknown plan");
        if (!isValidDeviceId(deviceId)) return fail("invalid device id");
        const order = await createOrder(env, planId, deviceId);
        return json({ id: order.id });
      }

      if (path === "/api/checkout/capture" && request.method === "POST") {
        if (!payPalConfigured(env)) return fail("payments not configured", 503);
        const body = await readBody(request);
        const orderId = String(body.orderId ?? "").trim();
        const email = String(body.email ?? "").trim();
        if (!orderId) return fail("orderId required");
        const order = await captureOrder(env, orderId);
        return json(await settle(env, order, email));
      }

      // Safety net for a buyer who paid but lost the tab before capture ran.
      if (path === "/api/checkout/recover" && request.method === "POST") {
        if (!payPalConfigured(env)) return fail("payments not configured", 503);
        const body = await readBody(request);
        const orderId = String(body.orderId ?? "").trim();
        if (!orderId) return fail("orderId required");
        const known = await registryJson<{ known: boolean }>(env, "/order-seen", { orderId });
        if (known.known) return json({ ok: true, alreadyIssued: true });
        let order = await getOrder(env, orderId);
        if (order.status !== "COMPLETED") {
          order = await captureOrder(env, orderId).catch(() => order);
        }
        return json(await settle(env, order, ""));
      }

      // ---- Dashboard -----------------------------------------------------
      if (path === "/api/admin/login" && request.method === "POST") {
        const body = await readBody(request);
        if (!env.ADMIN_PASSWORD?.trim()) return fail("dashboard password not configured", 503);
        if (!passwordMatches(env.ADMIN_PASSWORD.trim(), String(body.password ?? ""))) {
          return fail("wrong password", 401);
        }
        return json({ token: await issueToken(env.ADMIN_PASSWORD.trim()) });
      }

      if (path.startsWith("/api/admin/")) {
        if (!(await requireAdmin(request, env))) return fail("unauthorized", 401);
        const body = await readBody(request);

        if (path === "/api/admin/session") return json({ ok: true });

        if (path === "/api/admin/licenses") {
          return json(await registryJson(env, "/list", {}));
        }

        if (path === "/api/admin/set-status") {
          const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
          const status = String(body.status ?? "");
          return json(
            await registryJson(env, "/set-status", { deviceId, status, note: String(body.note ?? "") }),
          );
        }

        if (path === "/api/admin/extend") {
          const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
          return json(await registryJson(env, "/extend", { deviceId, days: Number(body.days ?? 0) }));
        }

        if (path === "/api/admin/update") {
          const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
          return json(
            await registryJson(env, "/update", {
              deviceId,
              label: String(body.label ?? ""),
              email: String(body.email ?? ""),
            }),
          );
        }

        if (path === "/api/admin/remove") {
          const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
          return json(await registryJson(env, "/remove", { deviceId }));
        }

        if (path === "/api/admin/grant") {
          const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
          const planId = String(body.plan ?? "");
          if (!isValidDeviceId(deviceId)) return fail("invalid device id");
          if (!isPlanId(planId)) return fail("unknown plan");
          return json(
            await registryJson(env, "/issue", {
              deviceId,
              plan: planId,
              label: String(body.label ?? ""),
              email: String(body.email ?? ""),
              orderId: "",
              amountCents: 0,
              source: "manual",
            }),
          );
        }

        return fail("not found", 404);
      }

      return fail("not found", 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected error";
      console.error("worker error", path, message);
      return fail(message, 500);
    }
  },
} satisfies ExportedHandler<Env>;

/** Verifies a captured PayPal order and writes the licence it paid for. */
async function settle(
  env: Env,
  order: { id: string; status: string; amountValue: string; currency: string; customId: string; payerEmail: string },
  fallbackEmail: string,
): Promise<Record<string, unknown>> {
  if (order.status !== "COMPLETED") {
    return { ok: false, error: `payment not completed (${order.status})` };
  }
  const [rawDeviceId, rawPlan] = order.customId.split("|");
  const deviceId = normalizeDeviceId(rawDeviceId ?? "");
  if (!isPlanId(rawPlan) || !isValidDeviceId(deviceId)) {
    return { ok: false, error: "order is missing device details" };
  }
  const plan = PLANS[rawPlan];
  const paidCents = Math.round(Number(order.amountValue) * 100);
  if (order.currency !== plan.currency || paidCents < plan.priceCents) {
    console.warn("amount mismatch", order.id, order.amountValue, order.currency);
    return { ok: false, error: "payment amount does not match the plan" };
  }
  const result = await registryJson<{ license: { expiresAt: number | null } }>(env, "/issue", {
    deviceId,
    plan: plan.id,
    orderId: order.id,
    amountCents: paidCents,
    email: order.payerEmail || fallbackEmail,
    source: "paypal",
  });
  return {
    ok: true,
    deviceId,
    plan: plan.id,
    expiresAt: result.license.expiresAt,
  };
}

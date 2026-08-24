import {
  generateTotpSecret,
  issueToken,
  otpauthUri,
  passwordMatches,
  usernameMatches,
  verifyToken,
  verifyTotp,
} from "./_lib/auth";
import {
  createCheckoutSession,
  getCheckoutSession,
  readSession,
  stripeConfigured,
  stripeMode,
  verifyWebhook,
  type CheckoutSession,
  type RawSession,
  type StripeEnv,
} from "./_lib/stripe";
import { PLANS, isPlanId, isValidDeviceId, normalizeDeviceId, priceString } from "./_lib/plans";

export { Registry } from "./registry";

type Env = StripeEnv & {
  DO: Fetcher;
  ADMIN_PASSWORD: string;
  ADMIN_USERNAME?: string;
  STORE_URL?: string;
};

/** Used until the owner sets their own name in the project settings. */
const DEFAULT_ADMIN_USERNAME = "admin";

const adminUsername = (env: Env): string => env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;

/** Keys of the dashboard security settings kept in the registry. */
const TWOFA_SECRET = "twofa_secret";
const TWOFA_PENDING = "twofa_pending";
const TWOFA_LAST_STEP = "twofa_last_step";

/** Where the app sends customers to buy. Overridable without an app update. */
const DEFAULT_STORE_URL = "https://novastream.rork.app";

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
  return verifyToken(env.ADMIN_PASSWORD, adminUsername(env), token);
}

const setting = async (env: Env, key: string): Promise<string> =>
  (await registryJson<{ value: string }>(env, "/settings-get", { key })).value;

const putSetting = (env: Env, key: string, value: string): Promise<{ ok: boolean }> =>
  registryJson<{ ok: boolean }>(env, "/settings-put", { key, value });

type LoginGuard = { blocked: boolean; retryInSeconds: number; failures: number };

const loginGuard = (env: Env, action: "check" | "fail" | "reset"): Promise<LoginGuard> =>
  registryJson<LoginGuard>(env, "/login-guard", { action });

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
          provider: "stripe",
          paymentsConfigured: stripeConfigured(env),
          mode: stripeMode(env),
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
      if (path === "/api/checkout/create-session" && request.method === "POST") {
        if (!stripeConfigured(env)) return fail("payments not configured", 503);
        const body = await readBody(request);
        const planId = String(body.plan ?? "");
        const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
        const email = String(body.email ?? "").trim();
        if (!isPlanId(planId)) return fail("unknown plan");
        if (!isValidDeviceId(deviceId)) return fail("invalid device id");
        const storeUrl = (env.STORE_URL?.trim() || DEFAULT_STORE_URL).replace(/\/+$/, "");
        const session = await createCheckoutSession(env, planId, deviceId, email, storeUrl);
        return json({ id: session.id, url: session.url });
      }

      // Called when Stripe sends the buyer back to the store with a session id.
      if (path === "/api/checkout/confirm" && request.method === "POST") {
        if (!stripeConfigured(env)) return fail("payments not configured", 503);
        const body = await readBody(request);
        const sessionId = String(body.sessionId ?? "").trim();
        if (!sessionId) return fail("sessionId required");
        const session = await getCheckoutSession(env, sessionId);
        return json(await settle(env, session));
      }

      // Authoritative path: fires even if the buyer closed the tab after paying.
      if (path === "/api/stripe/webhook" && request.method === "POST") {
        const payload = await request.text();
        const secret = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
        if (!secret) return fail("webhook secret not configured", 503);
        const signature = request.headers.get("Stripe-Signature");
        if (!(await verifyWebhook(secret, payload, signature))) {
          console.warn("stripe webhook signature rejected");
          return fail("invalid signature", 400);
        }
        const event = JSON.parse(payload) as { type?: string; data?: { object?: RawSession } };
        if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
          const session = readSession(event.data?.object ?? {});
          const result = await settle(env, session);
          if (!result.ok) console.warn("stripe webhook not settled", session.id, result.error);
        }
        return json({ received: true });
      }

      // ---- Dashboard -----------------------------------------------------
      if (path === "/api/admin/login" && request.method === "POST") {
        const body = await readBody(request);
        const password = env.ADMIN_PASSWORD?.trim() ?? "";
        if (!password) return fail("dashboard password not configured", 503);

        const guard = await loginGuard(env, "check");
        if (guard.blocked) {
          return json(
            { error: "too many attempts", retryInSeconds: guard.retryInSeconds },
            429,
          );
        }

        const username = adminUsername(env);
        const credentialsOk =
          usernameMatches(username, String(body.username ?? "")) &&
          passwordMatches(password, String(body.password ?? ""));
        if (!credentialsOk) {
          const after = await loginGuard(env, "fail");
          // Say so straight away when that attempt used up the last try,
          // instead of letting the next one look like a plain wrong password.
          if (after.blocked) {
            return json({ error: "too many attempts", retryInSeconds: after.retryInSeconds }, 429);
          }
          // Same message for a wrong name or a wrong password: no hints.
          return fail("wrong username or password", 401);
        }

        const secret = await setting(env, TWOFA_SECRET);
        if (secret) {
          const code = String(body.code ?? "").trim();
          if (!code) return json({ error: "two-factor code required", twofaRequired: true }, 401);
          const result = await verifyTotp(secret, code);
          const lastStep = Number(await setting(env, TWOFA_LAST_STEP)) || 0;
          // A code is single-use: replaying one seen on a shoulder gets nowhere.
          if (!result.valid || result.step <= lastStep) {
            const after = await loginGuard(env, "fail");
            if (after.blocked) {
              return json({ error: "too many attempts", retryInSeconds: after.retryInSeconds }, 429);
            }
            return json({ error: "invalid two-factor code", twofaRequired: true }, 401);
          }
          await putSetting(env, TWOFA_LAST_STEP, String(result.step));
        }

        await loginGuard(env, "reset");
        return json({ token: await issueToken(password, username) });
      }

      if (path.startsWith("/api/admin/")) {
        if (!(await requireAdmin(request, env))) return fail("unauthorized", 401);
        const body = await readBody(request);

        if (path === "/api/admin/session") return json({ ok: true });

        // ---- Dashboard security -----------------------------------------
        if (path === "/api/admin/security") {
          return json({
            username: adminUsername(env),
            usernameConfigured: Boolean(env.ADMIN_USERNAME?.trim()),
            twofaEnabled: Boolean(await setting(env, TWOFA_SECRET)),
          });
        }

        // Hands out a fresh secret and its QR payload; nothing is enforced
        // until the owner proves they can generate a code from it.
        if (path === "/api/admin/2fa/setup") {
          const secret = generateTotpSecret();
          await putSetting(env, TWOFA_PENDING, secret);
          return json({
            secret,
            otpauth: otpauthUri(secret, adminUsername(env)),
          });
        }

        if (path === "/api/admin/2fa/enable") {
          const pending = await setting(env, TWOFA_PENDING);
          if (!pending) return fail("start the setup first", 400);
          const result = await verifyTotp(pending, String(body.code ?? ""));
          if (!result.valid) return fail("invalid two-factor code", 400);
          await putSetting(env, TWOFA_SECRET, pending);
          await putSetting(env, TWOFA_PENDING, "");
          await putSetting(env, TWOFA_LAST_STEP, String(result.step));
          return json({ ok: true, twofaEnabled: true });
        }

        // Turning it off asks for both factors, so a stolen session cannot.
        if (path === "/api/admin/2fa/disable") {
          const secret = await setting(env, TWOFA_SECRET);
          if (!secret) return json({ ok: true, twofaEnabled: false });
          if (!passwordMatches(env.ADMIN_PASSWORD?.trim() ?? "", String(body.password ?? ""))) {
            return fail("wrong password", 401);
          }
          const result = await verifyTotp(secret, String(body.code ?? ""));
          if (!result.valid) return fail("invalid two-factor code", 400);
          await putSetting(env, TWOFA_SECRET, "");
          await putSetting(env, TWOFA_PENDING, "");
          return json({ ok: true, twofaEnabled: false });
        }

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

/** Verifies a paid Stripe session and writes the licence it paid for. */
async function settle(
  env: Env,
  session: CheckoutSession,
): Promise<{ ok: boolean; error?: string; deviceId?: string; plan?: string; expiresAt?: number | null }> {
  if (!session.paid) {
    return { ok: false, error: "payment not completed" };
  }
  const deviceId = normalizeDeviceId(session.deviceId);
  if (!isPlanId(session.plan) || !isValidDeviceId(deviceId)) {
    return { ok: false, error: "order is missing device details" };
  }
  const plan = PLANS[session.plan];
  if (session.currency !== plan.currency || session.amountTotal < plan.priceCents) {
    console.warn("amount mismatch", session.id, session.amountTotal, session.currency);
    return { ok: false, error: "payment amount does not match the plan" };
  }

  // Stripe can deliver the same purchase twice (redirect + webhook); the first
  // write wins so a buyer is never granted two stacked periods for one payment.
  const known = await registryJson<{ known: boolean }>(env, "/order-seen", { orderId: session.id });
  if (known.known) {
    const current = await registryJson<{ expiresAt: number | null }>(env, "/status", { deviceId });
    return { ok: true, deviceId, plan: plan.id, expiresAt: current.expiresAt };
  }

  const result = await registryJson<{ license: { expiresAt: number | null } }>(env, "/issue", {
    deviceId,
    plan: plan.id,
    orderId: session.id,
    amountCents: session.amountTotal,
    email: session.email,
    source: "stripe",
  });
  return {
    ok: true,
    deviceId,
    plan: plan.id,
    expiresAt: result.license.expiresAt,
  };
}

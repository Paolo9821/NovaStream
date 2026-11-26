import {
  generateTotpSecret,
  hashPassword,
  issueResellerToken,
  issueToken,
  otpauthUri,
  passwordMatches,
  readResellerToken,
  resellerTokenValid,
  usernameMatches,
  verifyPassword,
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
import { checkChallenge, createChallenge } from "./_lib/captcha";
import { importSealKey, newSealKeyMaterial, seal, unseal } from "./_lib/seal";
import { readTerm } from "./_lib/terms";
import { DEFAULT_SUPPORT_INBOX, escapeHtml, sendMail, type MailEnv } from "./_lib/mail";
import { normalizeCode, type PromoQuote } from "./registry";

export { Registry } from "./registry";

type Env = StripeEnv & MailEnv & {
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

/** Secrets generated on first use and kept in the registry, never in the code. */
const CAPTCHA_SECRET = "captcha_secret";
const PLAYLIST_SEAL_KEY = "playlist_seal_key";

/** Deliberately loose: enough to catch typos, not to police exotic addresses. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Where the app sends customers to buy. Overridable without an app update. */
const DEFAULT_STORE_URL = "https://novastreamapp.com";

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

const loginGuard = (env: Env, action: "check" | "fail" | "reset", key = "login"): Promise<LoginGuard> =>
  registryJson<LoginGuard>(env, "/login-guard", { action, key });

// ---- Audit log ----------------------------------------------------------------

type Actor = { type: "admin" | "reseller"; id: string; name: string };

const adminActor = (env: Env): Actor => ({ type: "admin", id: "admin", name: adminUsername(env) });

const ipOf = (request: Request): string => request.headers.get("CF-Connecting-IP") ?? "";

/** Never written to the log, even when they travel in a request body. */
const SECRET_FIELDS = new Set(["password", "hash", "salt", "code2fa", "token", "captchaToken", "captchaAnswer", "fromKey", "toKey"]);

function cleanDetails(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_FIELDS.has(key)) continue;
    if (key === "license" || key === "licenses" || key === "resellers" || key === "ok") continue;
    out[key] = item;
  }
  return out;
}

async function audit(
  env: Env,
  request: Request,
  actor: Actor,
  action: string,
  target: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await registry(env, "/audit", {
      actorType: actor.type,
      actorId: actor.id,
      actorName: actor.name,
      action,
      target,
      details: cleanDetails(details),
      ip: ipOf(request),
    });
  } catch (error) {
    console.warn("audit write failed", action, error instanceof Error ? error.message : error);
  }
}

/** Reads a JSON answer without consuming it, to tell a success from a refusal. */
async function outcomeOf(response: Response): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  let data: Record<string, unknown> = {};
  try {
    data = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    /* not JSON */
  }
  return { ok: response.ok && data.ok !== false && !data.error, data };
}

// ---- Resellers --------------------------------------------------------------

const RESELLER_TOKEN_SECRET = "reseller_token_secret";

type ResellerAccount = {
  id: string;
  username: string;
  pass_hash: string;
  pass_salt: string;
  pass_version: number;
  twofa_secret: string;
  twofa_pending: string;
  twofa_last_step: number;
  credits: number;
  disabled: number;
};

const resellerAccount = async (env: Env, query: { id?: string; username?: string }): Promise<ResellerAccount | null> =>
  (await registryJson<{ reseller: ResellerAccount | null }>(env, "/reseller-auth", query)).reseller;

async function requireReseller(request: Request, env: Env): Promise<ResellerAccount | null> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  const parsed = readResellerToken(token);
  if (!parsed) return null;
  const account = await resellerAccount(env, { id: parsed.id });
  if (!account || account.disabled === 1) return null;
  const secret = await generatedSecret(env, RESELLER_TOKEN_SECRET);
  return (await resellerTokenValid(secret, parsed, account.pass_version)) ? account : null;
}

/** What the app says about the hardware it runs on; shown to the owner next to each licence. */
function saveDeviceInfo(env: Env, ctx: ExecutionContext, request: Request, deviceId: string, mac: string, raw: unknown): void {
  if (!deviceId) return;
  const info = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  ctx.waitUntil(
    registry(env, "/device-info", {
      deviceId,
      mac,
      info,
      userAgent: request.headers.get("User-Agent") ?? "",
    }).catch(() => undefined),
  );
}

/** Random token handed to one browser after it used a device key. */
function newSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Only this hash is stored, so a copy of the registry opens no session. */
async function sessionHashOf(token: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(token)) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reads a generated secret, creating it the very first time it is needed. */
async function generatedSecret(env: Env, key: string): Promise<string> {
  const existing = await setting(env, key);
  if (existing) return existing;
  const fresh = newSealKeyMaterial();
  await putSetting(env, key, fresh);
  return fresh;
}

/** Credentials of a playlist sent from the website, as the app will import them. */
type PlaylistPayload = {
  name: string;
  type: "m3u" | "xtream";
  m3uUrl: string;
  server: string;
  username: string;
  password: string;
  epgUrl: string;
  /** Number of a private host from /app/host.json; the app looks up its address. */
  hostNumber?: string;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const hostOf = (value: string): string => {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
};

/** Checks and trims what the website sent; returns an error code on bad input. */
function readPlaylist(raw: unknown): { ok: true; value: PlaylistPayload } | { ok: false; error: string } {
  const item = (raw ?? {}) as Record<string, unknown>;
  const rawType = String(item.type ?? "");
  // A private host travels as an Xtream line without a server: only its number.
  if (rawType === "host") {
    const hostNumber = String(item.hostNumber ?? "").replace(/[^0-9A-Za-z]/g, "").slice(0, 12);
    const host: PlaylistPayload = {
      name: String(item.name ?? "").trim().slice(0, 60) || `Host ${hostNumber}`,
      type: "xtream",
      m3uUrl: "",
      server: "",
      username: String(item.username ?? "").trim().slice(0, 200),
      password: String(item.password ?? "").slice(0, 200),
      epgUrl: "",
      hostNumber,
    };
    if (!hostNumber) return { ok: false, error: "invalid host number" };
    if (!host.username || !host.password) return { ok: false, error: "missing credentials" };
    return { ok: true, value: host };
  }
  const type = rawType === "xtream" ? "xtream" : "m3u";
  const value: PlaylistPayload = {
    name: String(item.name ?? "").trim().slice(0, 60),
    type,
    m3uUrl: String(item.m3uUrl ?? "").trim().slice(0, 2000),
    server: String(item.server ?? "").trim().replace(/\/+$/, "").slice(0, 300),
    username: String(item.username ?? "").trim().slice(0, 200),
    password: String(item.password ?? "").slice(0, 200),
    epgUrl: String(item.epgUrl ?? "").trim().slice(0, 2000),
  };
  if (!value.name) value.name = type === "xtream" ? "Xtream" : "M3U";
  if (type === "m3u" && !isHttpUrl(value.m3uUrl)) return { ok: false, error: "invalid m3u url" };
  if (type === "xtream") {
    if (!isHttpUrl(value.server)) return { ok: false, error: "invalid server" };
    if (!value.username || !value.password) return { ok: false, error: "missing credentials" };
  }
  if (value.epgUrl && !isHttpUrl(value.epgUrl)) return { ok: false, error: "invalid epg url" };
  if (type === "m3u") {
    value.server = "";
    value.username = "";
    value.password = "";
  } else {
    value.m3uUrl = "";
  }
  return { ok: true, value };
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
        // The app also reports its MAC, because that is what most customers type
        // on the store. Either identifier must open the licence they paid for.
        const mac = normalizeDeviceId(String(body.mac ?? ""));
        if (!deviceId && !mac) return fail("deviceId required");
        // Set when the app holds no local trace of its trial, i.e. a fresh
        // install. The server keeps the original start date either way.
        const fresh = body.fresh === true;
        const result = await registryJson<Record<string, unknown>>(env, "/status", {
          deviceId: deviceId || mac,
          identifiers: [deviceId, mac],
          fresh,
        });
        saveDeviceInfo(env, ctx, request, deviceId || mac, mac, body.device);
        return json(result);
      }

      // ---- Playlists managed from the website ------------------------------
      // Called by the app at launch, on resume and after each change: the answer
      // carries the key shown on screen and what the website asked for.
      if (path === "/api/device/sync" && request.method === "POST") {
        const body = await readBody(request);
        const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
        const mac = normalizeDeviceId(String(body.mac ?? ""));
        if (!isValidDeviceId(deviceId)) return fail("invalid device id");
        const result = await registryJson<{
          ok: boolean;
          key: string;
          keyExpiresAt: number;
          lastOpenAt: number;
          serverTime: number;
          install: { id: string; sealed: string }[];
          remove: string[];
        }>(env, "/device-sync", { deviceId, mac, playlists: body.playlists });
        if (!result.ok) return fail("sync failed", 500);
        saveDeviceInfo(env, ctx, request, deviceId, mac, body.device);
        const key = await importSealKey(await generatedSecret(env, PLAYLIST_SEAL_KEY));
        const install: (PlaylistPayload & { id: string })[] = [];
        for (const item of result.install) {
          const plain = await unseal(key, item.sealed);
          if (!plain) continue;
          try {
            install.push({ id: item.id, ...(JSON.parse(plain) as PlaylistPayload) });
          } catch {
            console.warn("device playlist payload unreadable", item.id);
          }
        }
        return json({
          key: result.key,
          keyExpiresAt: result.keyExpiresAt,
          lastOpenAt: result.lastOpenAt,
          serverTime: result.serverTime,
          install,
          remove: result.remove,
        });
      }

      if (path === "/api/captcha") {
        return json(await createChallenge(await generatedSecret(env, CAPTCHA_SECRET)));
      }

      if (path === "/api/device/open" && request.method === "POST") {
        const body = await readBody(request);
        const identifier = normalizeDeviceId(String(body.identifier ?? ""));
        if (!isValidDeviceId(identifier)) return fail("invalid device id");
        // The key is single use: a right one is burnt and swapped for a session.
        const session = newSessionToken();
        const result = await registryJson<{ ok: boolean; error?: string; retryInSeconds?: number }>(
          env,
          "/device-open",
          { identifier, key: String(body.key ?? ""), sessionHash: await sessionHashOf(session) },
        );
        if (!result.ok) return json(result, result.retryInSeconds ? 429 : 403);
        return json({ ...result, session });
      }

      if (path === "/api/device/view" && request.method === "POST") {
        const body = await readBody(request);
        const identifier = normalizeDeviceId(String(body.identifier ?? ""));
        const result = await registryJson<{ ok: boolean; error?: string }>(env, "/device-view", {
          identifier,
          sessionHash: await sessionHashOf(String(body.session ?? "")),
        });
        if (!result.ok) return json(result, 401);
        return json(result);
      }

      if (path === "/api/device/playlist-add" && request.method === "POST") {
        const body = await readBody(request);
        const identifier = normalizeDeviceId(String(body.identifier ?? ""));
        if (!isValidDeviceId(identifier)) return fail("invalid device id");

        // No CAPTCHA here: the short-lived device session (one code from the TV,
        // good for 5 minutes) and the registry's lockouts already gate this.
        const parsed = readPlaylist(body.playlist);
        if (!parsed.ok) return fail(parsed.error);
        const playlist = parsed.value;
        const sealKey = await importSealKey(await generatedSecret(env, PLAYLIST_SEAL_KEY));
        const result = await registryJson<{ ok: boolean; error?: string; retryInSeconds?: number }>(
          env,
          "/device-playlist-add",
          {
            identifier,
            sessionHash: await sessionHashOf(String(body.session ?? "")),
            id: crypto.randomUUID(),
            name: playlist.name,
            type: playlist.type,
            host: playlist.hostNumber
              ? `Host ${playlist.hostNumber}`
              : hostOf(playlist.type === "xtream" ? playlist.server : playlist.m3uUrl),
            sealed: await seal(sealKey, JSON.stringify(playlist)),
          },
        );
        if (!result.ok) {
          const status =
            result.error === "session expired" ? 401 : result.error === "too many playlists" ? 409 : 403;
          return json(result, status);
        }
        return json(result);
      }

      if (path === "/api/device/playlist-remove" && request.method === "POST") {
        const body = await readBody(request);
        const identifier = normalizeDeviceId(String(body.identifier ?? ""));
        if (!isValidDeviceId(identifier)) return fail("invalid device id");
        const result = await registryJson<{ ok: boolean; error?: string; retryInSeconds?: number }>(
          env,
          "/device-playlist-remove",
          {
            identifier,
            sessionHash: await sessionHashOf(String(body.session ?? "")),
            id: String(body.id ?? ""),
          },
        );
        if (!result.ok) return json(result, result.error === "session expired" ? 401 : 403);
        return json(result);
      }

      // ---- Support requests ------------------------------------------------
      // Public: the contact form on the store writes straight into the
      // dashboard, so nothing depends on an inbox being watched.
      if (path === "/api/support/ticket" && request.method === "POST") {
        const body = await readBody(request);
        const email = String(body.email ?? "").trim().slice(0, 160);
        const message = String(body.message ?? "").trim().slice(0, 4000);
        const topic = String(body.topic ?? "other").trim().slice(0, 40);
        const lang = String(body.lang ?? "").trim().slice(0, 5);
        const deviceId = normalizeDeviceId(String(body.deviceId ?? "")).slice(0, 32);
        if (!EMAIL_RE.test(email)) return fail("invalid email");
        if (message.length < 10) return fail("message too short");
        const created = await registryJson<{ ok: boolean; id?: string; error?: string }>(
          env,
          "/ticket-create",
          { email, message, topic, lang, deviceId },
        );
        if (!created.ok) return fail(created.error ?? "could not save request", 429);
        // A copy goes to the support inbox; the dashboard stays the source of truth,
        // so a mail outage never loses a request.
        ctx.waitUntil(mailTicket(env, { id: created.id ?? "", email, message, topic, lang, deviceId }));
        return json({ ok: true, id: created.id });
      }

      // ---- Licence transfer ------------------------------------------------
      // Moves a licence to a new device. The new device proves itself with the
      // key its app shows; the licence with the email used for the purchase.
      if (path === "/api/license/transfer" && request.method === "POST") {
        const body = await readBody(request);
        const fromId = normalizeDeviceId(String(body.fromId ?? ""));
        const toId = normalizeDeviceId(String(body.toId ?? ""));
        if (!isValidDeviceId(fromId) || !isValidDeviceId(toId)) return fail("invalid device id");
        // The purchase email is the only way left to prove the licence is yours.
        const method = "email";
        const fromEmail = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
        if (!EMAIL_RE.test(fromEmail)) return fail("invalid email");

        const check = await checkChallenge(
          await generatedSecret(env, CAPTCHA_SECRET),
          String(body.captchaToken ?? ""),
          String(body.captchaAnswer ?? ""),
        );
        if (check.nonce) {
          const burn = await registryJson<{ fresh: boolean }>(env, "/captcha-burn", {
            nonce: check.nonce,
            expiresAt: check.expiresAt,
          });
          if (!burn.fresh) return json({ error: "captcha used", captcha: true }, 400);
        }
        if (!check.ok) {
          return json({ error: check.reason === "expired" ? "captcha expired" : "captcha wrong", captcha: true }, 400);
        }

        const result = await registryJson<TransferResult>(env, "/license-transfer", {
          fromId,
          toId,
          method,
          toKey: String(body.toKey ?? ""),
          email: fromEmail,
          ip: request.headers.get("CF-Connecting-IP") ?? "",
        });
        if (!result.ok) {
          const status = result.retryInSeconds ? 429 : result.error === "licence not found" ? 404 : 400;
          return json(result, status);
        }
        ctx.waitUntil(mailTransfer(env, result));
        // The purchase email stays on the server.
        return json({ ok: true, fromId: result.fromId, toId: result.toId, plan: result.plan, expiresAt: result.expiresAt });
      }

      // ---- Promo codes -----------------------------------------------------
      // Tells the store what a code is worth on the chosen plan before paying.
      if (path === "/api/promo/check" && request.method === "POST") {
        const body = await readBody(request);
        const code = normalizeCode(String(body.code ?? ""));
        if (!code) return fail("code required");
        const quote = await registryJson<PromoQuote>(env, "/promo-quote", {
          code,
          plan: String(body.plan ?? ""),
          ip: request.headers.get("CF-Connecting-IP") ?? "",
        });
        if (!quote.ok) return json(quote, quote.error === "too many attempts" ? 429 : 400);
        return json(quote);
      }

      // Gift codes (and 100% discounts) unlock the licence straight away, no payment.
      if (path === "/api/promo/redeem" && request.method === "POST") {
        const body = await readBody(request);
        const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
        if (!isValidDeviceId(deviceId)) return fail("invalid device id");
        const redeemEmail = String(body.email ?? "").trim().slice(0, 160);
        if (!EMAIL_RE.test(redeemEmail)) return fail("invalid email");
        const result = await registryJson<{ ok: boolean; error?: string }>(env, "/promo-redeem", {
          code: normalizeCode(String(body.code ?? "")),
          plan: String(body.plan ?? ""),
          deviceId,
          identifiers: [deviceId],
          email: redeemEmail,
          ip: request.headers.get("CF-Connecting-IP") ?? "",
        });
        if (!result.ok) return json(result, result.error === "too many attempts" ? 429 : 400);
        return json(result);
      }

      // ---- Checkout ------------------------------------------------------
      if (path === "/api/checkout/create-session" && request.method === "POST") {
        if (!stripeConfigured(env)) return fail("payments not configured", 503);
        const body = await readBody(request);
        const planId = String(body.plan ?? "");
        const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
        const email = String(body.email ?? "").trim().slice(0, 160);
        if (!isPlanId(planId)) return fail("unknown plan");
        if (!isValidDeviceId(deviceId)) return fail("invalid device id");
        if (!EMAIL_RE.test(email)) return fail("invalid email");
        const consent = readConsent(request, body.consent);
        if (!consent) return fail("consent required");
        // The discount is worked out again here: the browser only names the code.
        const code = normalizeCode(String(body.code ?? ""));
        let promo: { code: string; finalCents: number } | undefined;
        if (code) {
          const quote = await registryJson<PromoQuote>(env, "/promo-quote", {
            code,
            plan: planId,
            ip: request.headers.get("CF-Connecting-IP") ?? "",
          });
          if (!quote.ok) return fail(quote.error);
          if (quote.finalCents === 0) return fail("code is free, redeem it");
          promo = { code: quote.code, finalCents: quote.finalCents };
        }
        const storeUrl = (env.STORE_URL?.trim() || DEFAULT_STORE_URL).replace(/\/+$/, "");
        const session = await createCheckoutSession(
          env,
          planId,
          deviceId,
          email,
          storeUrl,
          consent.acceptedAt,
          promo,
        );
        // Kept against the Stripe session id, which becomes the order id once paid.
        await registry(env, "/consent-save", { sessionId: session.id, deviceId, plan: planId, ...consent });
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
          // Resellers sign in from the same "Gestione" page: once their own password
          // checks out, the site carries on with the reseller login (2FA included).
          const typed = String(body.username ?? "").trim().toLowerCase().slice(0, 64);
          if (typed && !usernameMatches(username, typed)) {
            const account = await resellerAccount(env, { username: typed });
            if (
              account &&
              (await verifyPassword(String(body.password ?? ""), account.pass_hash, account.pass_salt))
            ) {
              return json({ reseller: true });
            }
          }
          await audit(
            env,
            request,
            { type: "admin", id: "admin", name: String(body.username ?? "").slice(0, 64) },
            "login_failed",
            "pannello",
            { reason: "credentials" },
          );
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
            await audit(env, request, adminActor(env), "login_failed", "pannello", { reason: "2fa" });
            const after = await loginGuard(env, "fail");
            if (after.blocked) {
              return json({ error: "too many attempts", retryInSeconds: after.retryInSeconds }, 429);
            }
            return json({ error: "invalid two-factor code", twofaRequired: true }, 401);
          }
          await putSetting(env, TWOFA_LAST_STEP, String(result.step));
        }

        await loginGuard(env, "reset");
        await audit(env, request, adminActor(env), "login", "pannello");
        return json({ token: await issueToken(password, username) });
      }

      // ---- Reseller panel ----------------------------------------------------
      if (path === "/api/reseller/login" && request.method === "POST") {
        const body = await readBody(request);
        const typed = String(body.username ?? "").trim().toLowerCase().slice(0, 64);
        const guardKey = `rlogin_${typed.replace(/[^a-z0-9._-]/g, "") || "_"}`;
        const guard = await loginGuard(env, "check", guardKey);
        if (guard.blocked) return json({ error: "too many attempts", retryInSeconds: guard.retryInSeconds }, 429);

        const refuse = async (reason: string, account: ResellerAccount | null, twofa = false): Promise<Response> => {
          await audit(
            env,
            request,
            { type: "reseller", id: account?.id ?? "", name: account?.username ?? typed },
            "login_failed",
            "pannello rivenditore",
            { reason },
          );
          const after = await loginGuard(env, "fail", guardKey);
          if (after.blocked) return json({ error: "too many attempts", retryInSeconds: after.retryInSeconds }, 429);
          return twofa
            ? json({ error: "invalid two-factor code", twofaRequired: true }, 401)
            : fail("wrong username or password", 401);
        };

        const account = typed ? await resellerAccount(env, { username: typed }) : null;
        const passwordOk = account
          ? await verifyPassword(String(body.password ?? ""), account.pass_hash, account.pass_salt)
          : false;
        // A disabled account gets the same answer as a wrong password: no hints.
        if (!account || !passwordOk) return refuse("credentials", account);
        if (account.disabled === 1) return refuse("disabled", account);

        const code = String(body.code ?? "").trim();
        const actor: Actor = { type: "reseller", id: account.id, name: account.username };
        const tokenSecret = await generatedSecret(env, RESELLER_TOKEN_SECRET);

        // First login (or after a reset): two-factor is set up before anything else.
        if (!account.twofa_secret) {
          if (code && account.twofa_pending) {
            const result = await verifyTotp(account.twofa_pending, code);
            if (!result.valid) return refuse("2fa setup", account, true);
            await registry(env, "/reseller-twofa", { id: account.id, op: "activate", step: result.step });
            await loginGuard(env, "reset", guardKey);
            await audit(env, request, actor, "2fa_enabled", account.username);
            await audit(env, request, actor, "login", "pannello rivenditore");
            return json({
              token: await issueResellerToken(tokenSecret, account.id, account.pass_version),
              username: account.username,
            });
          }
          const secret = account.twofa_pending || generateTotpSecret();
          if (!account.twofa_pending) {
            await registry(env, "/reseller-twofa", { id: account.id, op: "pending", secret });
          }
          return json({
            setup: { secret, otpauth: otpauthUri(secret, account.username, "NovaStream Reseller") },
          });
        }

        if (!code) return json({ error: "two-factor code required", twofaRequired: true }, 401);
        const result = await verifyTotp(account.twofa_secret, code);
        if (!result.valid || result.step <= account.twofa_last_step) return refuse("2fa", account, true);
        await registry(env, "/reseller-twofa", { id: account.id, op: "login", step: result.step });
        await loginGuard(env, "reset", guardKey);
        await audit(env, request, actor, "login", "pannello rivenditore");
        return json({
          token: await issueResellerToken(tokenSecret, account.id, account.pass_version),
          username: account.username,
        });
      }

      if (path.startsWith("/api/reseller/")) {
        const account = await requireReseller(request, env);
        if (!account) return fail("unauthorized", 401);
        const body = await readBody(request);
        const actor: Actor = { type: "reseller", id: account.id, name: account.username };
        const name = path.slice("/api/reseller/".length);
        const response = await resellerRoute(env, account, name, body);
        if (name !== "me") {
          const outcome = await outcomeOf(response);
          const action =
            name === "license-status" ? (body.status === "revoked" ? "license-revoke" : "license-restore") : name;
          await audit(
            env,
            request,
            actor,
            outcome.ok ? action : `${action}_refused`,
            targetOf(body, outcome.data),
            { ...body, ...outcome.data },
          );
        }
        return response;
      }

      if (path.startsWith("/api/admin/")) {
        if (!(await requireAdmin(request, env))) return fail("unauthorized", 401);
        const body = await readBody(request);
        const response = await adminRoute(env, request, path, body);
        const name = path.slice("/api/admin/".length);
        if (!ADMIN_READS.has(name)) {
          const outcome = await outcomeOf(response);
          if (outcome.ok) {
            // Two-factor requests carry one-time codes: only the fact is kept.
            const details = name.startsWith("2fa") ? {} : { ...body, ...outcome.data };
            await audit(env, request, adminActor(env), name, targetOf(body, outcome.data), details);
          }
        }
        return response;
      }

      return fail("not found", 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected error";
      console.error("worker error", path, message);
      return fail(message, 500);
    }
  },
} satisfies ExportedHandler<Env>;

/** Everything a reseller can do from their own panel, always limited to their own customers. */
async function resellerRoute(
  env: Env,
  account: ResellerAccount,
  name: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const answer = (result: { ok: boolean; error?: string }) => (result.ok ? json(result) : json(result, 400));
  const resellerId = account.id;

  if (name === "me") return json(await registryJson(env, "/reseller-data", { resellerId }));

  if (name === "activate") {
    const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
    const mac = normalizeDeviceId(String(body.mac ?? ""));
    if (!isValidDeviceId(deviceId)) return fail("invalid device id");
    const email = String(body.email ?? "").trim().slice(0, 160);
    if (!EMAIL_RE.test(email)) return fail("invalid email");
    return answer(
      await registryJson(env, "/reseller-activate", {
        resellerId,
        deviceId,
        mac,
        years: Number(body.years ?? 1),
        email,
        note: String(body.note ?? ""),
      }),
    );
  }

  if (name === "code-create") {
    return answer(
      await registryJson(env, "/reseller-code-create", {
        resellerId,
        count: Number(body.count ?? 1),
        years: Number(body.years ?? 1),
        note: String(body.note ?? ""),
      }),
    );
  }

  if (name === "note") {
    return answer(
      await registryJson(env, "/reseller-note", {
        resellerId,
        deviceId: normalizeDeviceId(String(body.deviceId ?? "")),
        note: String(body.note ?? ""),
      }),
    );
  }

  if (name === "license-status") {
    return answer(
      await registryJson(env, "/reseller-license-status", {
        resellerId,
        deviceId: normalizeDeviceId(String(body.deviceId ?? "")),
        status: String(body.status ?? ""),
      }),
    );
  }

  if (name === "redemption-revoke" || name === "redemption-restore") {
    return answer(await registryJson(env, `/${name}`, { id: String(body.id ?? ""), resellerId }));
  }

  return fail("not found", 404);
}

/** Dashboard reads: not written to the log, which keeps only what changed something. */
const ADMIN_READS = new Set([
  "session",
  "security",
  "tickets",
  "licenses",
  "promo-list",
  "transfers",
  "resellers",
  "logs",
  "2fa/setup",
]);

/** The licence, code, account or use an action was about, for the log. */
function targetOf(body: Record<string, unknown>, data: Record<string, unknown>): string {
  if (body.fromId && body.toId) return `${String(body.fromId)} → ${String(body.toId)}`;
  const pick = (value: unknown) => (typeof value === "string" && value ? value : "");
  return (
    pick(data.username) ||
    pick(body.username) ||
    pick(body.deviceId) ||
    pick(data.deviceId) ||
    pick(body.code) ||
    pick(data.code) ||
    pick(body.id) ||
    pick(data.id) ||
    ""
  ).slice(0, 200);
}

async function adminRoute(env: Env, request: Request, path: string, body: Record<string, unknown>): Promise<Response> {
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

  // ---- Support inbox ------------------------------------------------
  if (path === "/api/admin/tickets") {
    return json(await registryJson(env, "/ticket-list", {}));
  }

  if (path === "/api/admin/ticket-status") {
    return json(
      await registryJson(env, "/ticket-status", {
        id: String(body.id ?? ""),
        status: String(body.status ?? ""),
        note: String(body.note ?? ""),
      }),
    );
  }

  if (path === "/api/admin/ticket-remove") {
    return json(await registryJson(env, "/ticket-remove", { id: String(body.id ?? "") }));
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

  if (path === "/api/admin/set-term") {
    const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
    const term = readTerm(body.term);
    if (!term) return fail("invalid duration");
    return json(await registryJson(env, "/set-term", { deviceId, term }));
  }

  // ---- Promo codes ------------------------------------------------
  if (path === "/api/admin/promo-list") {
    return json(await registryJson(env, "/promo-list", {}));
  }

  if (path === "/api/admin/promo-create") {
    const result = await registryJson<{ ok: boolean; error?: string }>(env, "/promo-create", body);
    return result.ok ? json(result) : fail(result.error ?? "could not create code");
  }

  if (path === "/api/admin/promo-toggle") {
    return json(
      await registryJson(env, "/promo-toggle", { code: String(body.code ?? ""), active: body.active === true }),
    );
  }

  if (path === "/api/admin/promo-remove") {
    return json(await registryJson(env, "/promo-remove", { code: String(body.code ?? "") }));
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

  // The owner can move a licence without any key, and without the waiting period.
  if (path === "/api/admin/transfer") {
    const fromId = normalizeDeviceId(String(body.fromId ?? ""));
    const toId = normalizeDeviceId(String(body.toId ?? ""));
    if (!isValidDeviceId(fromId) || !isValidDeviceId(toId)) return fail("invalid device id");
    const result = await registryJson<TransferResult>(env, "/license-transfer", {
      fromId,
      toId,
      method: "admin",
      toMac: normalizeDeviceId(String(body.toMac ?? "")),
    });
    return result.ok ? json(result) : json(result, 400);
  }

  if (path === "/api/admin/transfers") {
    return json(await registryJson(env, "/transfer-list", {}));
  }

  if (path === "/api/admin/remove") {
    const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
    return json(await registryJson(env, "/remove", { deviceId }));
  }

  if (path === "/api/admin/grant") {
    const deviceId = normalizeDeviceId(String(body.deviceId ?? ""));
    const mac = normalizeDeviceId(String(body.mac ?? ""));
    const planId = String(body.plan ?? "");
    if (!isValidDeviceId(deviceId)) return fail("invalid device id");
    // A duration (1/3/6/12 months, lifetime, a date) wins over the plan's default.
    const term = body.term === undefined ? null : readTerm(body.term);
    if (body.term !== undefined && !term) return fail("invalid duration");
    if (!term && !isPlanId(planId)) return fail("unknown plan");
    return json(
      await registryJson(env, "/issue", {
        deviceId,
        identifiers: [deviceId, mac],
        plan: term ? (term.kind === "lifetime" ? "lifetime" : "annual") : planId,
        ...(term ? { term } : {}),
        label: String(body.label ?? ""),
        email: String(body.email ?? ""),
        orderId: "",
        amountCents: 0,
        source: "manual",
        resellerId: String(body.resellerId ?? ""),
      }),
    );
  }

  // ---- Code uses ------------------------------------------------------------
  if (path === "/api/admin/redemption-revoke" || path === "/api/admin/redemption-restore") {
    const route = path.endsWith("revoke") ? "/redemption-revoke" : "/redemption-restore";
    const result = await registryJson<{ ok: boolean; error?: string }>(env, route, { id: String(body.id ?? "") });
    return result.ok ? json(result) : json(result, 400);
  }

  if (path === "/api/admin/redemption-email") {
    const email = String(body.email ?? "").trim().slice(0, 160);
    if (!EMAIL_RE.test(email)) return fail("invalid email");
    const result = await registryJson<{ ok: boolean; error?: string }>(env, "/redemption-email", {
      id: String(body.id ?? ""),
      email,
    });
    return result.ok ? json(result) : json(result, 400);
  }

  if (path === "/api/admin/promo-update") {
    const update: Record<string, unknown> = { code: String(body.code ?? "") };
    if (body.maxUses !== undefined) update.maxUses = Number(body.maxUses);
    if (body.resellerId !== undefined) update.resellerId = String(body.resellerId ?? "");
    if (body.note !== undefined) update.note = String(body.note ?? "");
    const result = await registryJson<{ ok: boolean; error?: string }>(env, "/promo-update", update);
    return result.ok ? json(result) : json(result, 400);
  }

  // ---- Resellers -------------------------------------------------------------
  if (path === "/api/admin/resellers") {
    return json(await registryJson(env, "/reseller-list", {}));
  }

  if (path === "/api/admin/reseller-create") {
    const password = String(body.password ?? "");
    if (password.length < 8 || password.length > 200) return fail("password too short");
    const { hash, salt } = await hashPassword(password);
    const result = await registryJson<{ ok: boolean; error?: string }>(env, "/reseller-create", {
      username: String(body.username ?? ""),
      hash,
      salt,
      credits: Number(body.credits ?? 0),
    });
    return result.ok ? json(result) : json(result, 400);
  }

  if (path === "/api/admin/reseller-update") {
    const update: Record<string, unknown> = { id: String(body.id ?? "") };
    const username = String(body.username ?? "").trim();
    if (username) update.username = username;
    const password = String(body.password ?? "");
    if (password) {
      if (password.length < 8 || password.length > 200) return fail("password too short");
      Object.assign(update, await hashPassword(password));
    }
    if (!update.username && !update.hash) return fail("nothing to change");
    const result = await registryJson<{ ok: boolean; error?: string }>(env, "/reseller-update", update);
    return result.ok
      ? json({ ...result, passwordChanged: Boolean(password) })
      : json(result, 400);
  }

  if (path === "/api/admin/reseller-reset-2fa") {
    const result = await registryJson<{ ok: boolean }>(env, "/reseller-reset-2fa", { id: String(body.id ?? "") });
    return result.ok ? json(result) : json(result, 400);
  }

  if (path === "/api/admin/reseller-delete") {
    const result = await registryJson<{ ok: boolean }>(env, "/reseller-delete", { id: String(body.id ?? "") });
    return result.ok ? json(result) : json(result, 400);
  }

  if (path === "/api/admin/reseller-credits") {
    const result = await registryJson<{ ok: boolean }>(env, "/reseller-credits", {
      id: String(body.id ?? ""),
      delta: Number(body.delta ?? 0),
    });
    return result.ok ? json(result) : json(result, 400);
  }

  if (path === "/api/admin/reseller-disable") {
    const result = await registryJson<{ ok: boolean }>(env, "/reseller-disable", {
      id: String(body.id ?? ""),
      disabled: body.disabled === true,
    });
    return result.ok ? json(result) : json(result, 400);
  }

  // Licences found by MAC or device id, one per line, go to a reseller's panel.
  if (path === "/api/admin/assign-reseller") {
    const raw = Array.isArray(body.identifiers)
      ? body.identifiers.map(String)
      : String(body.identifiers ?? "").split(/[\s,;]+/);
    const identifiers = [...new Set(raw.map((value) => normalizeDeviceId(value)).filter(Boolean))].slice(0, 500);
    if (identifiers.length === 0) return fail("invalid device id");
    const result = await registryJson<{ ok: boolean }>(env, "/assign-reseller", {
      identifiers,
      resellerId: String(body.resellerId ?? ""),
    });
    return result.ok ? json(result) : json(result, 400);
  }

  // ---- Activity log ----------------------------------------------------------
  if (path === "/api/admin/logs") {
    return json(
      await registryJson(env, "/logs", {
        actorType: String(body.actorType ?? ""),
        actorId: String(body.actorId ?? ""),
        limit: Number(body.limit ?? 500),
      }),
    );
  }

  return fail("not found", 404);
}

type TransferResult = {
  ok: boolean;
  error?: string;
  retryInSeconds?: number;
  fromId?: string;
  toId?: string;
  plan?: string;
  expiresAt?: number | null;
  email?: string;
  method?: string;
};

const TOPIC_LABELS: Record<string, string> = {
  subscription: "Abbonamento / licenza",
  payment: "Pagamento",
  activation: "Attivazione",
  deletion: "Cancellazione dati",
  other: "Altro",
};

/** Forwards a new support request to the support inbox, reply-to the customer. */
async function mailTicket(
  env: Env,
  ticket: { id: string; email: string; message: string; topic: string; lang: string; deviceId: string },
): Promise<void> {
  const topic = TOPIC_LABELS[ticket.topic] ?? ticket.topic;
  const lines = [
    `Nuova richiesta di assistenza ${ticket.id}`,
    "",
    `Da: ${ticket.email}`,
    `Argomento: ${topic}`,
    `Dispositivo: ${ticket.deviceId || "-"}`,
    `Lingua: ${ticket.lang || "-"}`,
    "",
    ticket.message,
    "",
    "Rispondi a questa email per scrivere direttamente al cliente.",
    "La richiesta è anche nel pannello: https://novastreamapp.com/dashboard",
  ];
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">
<h2 style="margin:0 0 12px">Nuova richiesta di assistenza</h2>
<table style="border-collapse:collapse">
<tr><td style="padding:2px 12px 2px 0;color:#666">Riferimento</td><td><b>${escapeHtml(ticket.id)}</b></td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Da</td><td><a href="mailto:${escapeHtml(ticket.email)}">${escapeHtml(ticket.email)}</a></td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Argomento</td><td>${escapeHtml(topic)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Dispositivo</td><td style="font-family:monospace">${escapeHtml(ticket.deviceId || "-")}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#666">Lingua</td><td>${escapeHtml(ticket.lang || "-")}</td></tr>
</table>
<div style="margin:16px 0;padding:12px 14px;background:#f4f4f6;border-radius:8px;white-space:pre-wrap">${escapeHtml(ticket.message)}</div>
<p style="color:#666">Rispondi a questa email per scrivere direttamente al cliente. La richiesta è anche nel <a href="https://novastreamapp.com/dashboard">pannello</a>.</p>
</div>`;
  await sendMail(env, {
    to: env.SUPPORT_INBOX?.trim() || DEFAULT_SUPPORT_INBOX,
    subject: `[NovaStream] ${topic} - ${ticket.email} (${ticket.id})`,
    text: lines.join("\n"),
    html,
    replyTo: ticket.email,
  });
}

/** Lets the support inbox know a customer moved their licence themselves. */
async function mailTransfer(env: Env, result: TransferResult): Promise<void> {
  const text = [
    "Licenza trasferita dal sito",
    "",
    `Dal dispositivo: ${result.fromId ?? "-"}`,
    `Al dispositivo: ${result.toId ?? "-"}`,
    `Piano: ${result.plan ?? "-"}`,
    `Verifica: ${result.method === "email" ? "email di acquisto" : "chiave del vecchio dispositivo"}`,
    `Email licenza: ${result.email || "-"}`,
  ].join("\n");
  const inbox = env.SUPPORT_INBOX?.trim() || DEFAULT_SUPPORT_INBOX;
  await sendMail(env, {
    to: inbox,
    subject: `[NovaStream] Trasferimento licenza ${result.fromId} → ${result.toId}`,
    text,
    ...(result.email ? { replyTo: result.email } : {}),
  });
  // The owner hears about it too, so a move they did not make is noticed at once.
  if (result.email && EMAIL_RE.test(result.email)) {
    await sendMail(env, {
      to: result.email,
      subject: "NovaStream: licence moved to a new device",
      text: [
        "Your NovaStream licence has been moved to a new device.",
        "",
        `Old device: ${result.fromId ?? "-"}`,
        `New device: ${result.toId ?? "-"}`,
        "",
        "If you did not do this, reply to this email right away.",
        "",
        "La tua licenza NovaStream è stata trasferita su un nuovo dispositivo.",
        "Se non sei stato tu, rispondi subito a questa email.",
      ].join("\n"),
      replyTo: inbox,
    });
  }
}

type ConsentRecord = {
  acceptedAt: number;
  recordedAt: number;
  ip: string;
  userAgent: string;
  lang: string;
  text: string;
};

/**
 * Reads the buyer's "I already tried the app" confirmation. The browser's tick
 * time is kept only when plausible; the server clock is always stored next to it.
 */
function readConsent(request: Request, raw: unknown): ConsentRecord | null {
  const input = (raw ?? {}) as Record<string, unknown>;
  if (input.accepted !== true) return null;
  const recordedAt = Date.now();
  const claimed = Number(input.acceptedAt);
  const plausible =
    Number.isFinite(claimed) && claimed <= recordedAt + 60_000 && claimed >= recordedAt - 6 * 60 * 60 * 1000;
  return {
    acceptedAt: plausible ? Math.min(claimed, recordedAt) : recordedAt,
    recordedAt,
    ip: (request.headers.get("CF-Connecting-IP") ?? "").slice(0, 64),
    userAgent: (request.headers.get("User-Agent") ?? "").slice(0, 300),
    lang: String(input.lang ?? "").slice(0, 8),
    text: String(input.text ?? "").trim().slice(0, 1000),
  };
}

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
  // A discounted checkout carries the price the server set; older ones the list price.
  const expected = session.promoCode && session.expectedCents > 0 ? session.expectedCents : plan.priceCents;
  if (session.currency !== plan.currency || session.amountTotal < expected) {
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
  if (session.promoCode) {
    await registry(env, "/promo-record-paid", {
      code: session.promoCode,
      orderId: session.id,
      deviceId,
      plan: plan.id,
      discountCents: Math.max(0, plan.priceCents - session.amountTotal),
      paidCents: session.amountTotal,
      email: session.email,
    });
  }
  return {
    ok: true,
    deviceId,
    plan: plan.id,
    expiresAt: result.license.expiresAt,
  };
}

import { DurableObject } from "cloudflare:workers";
import { PLANS, type PlanId } from "./_lib/plans";

/** Lifecycle of a licence as stored in the registry. */
export type StoredStatus = "active" | "suspended" | "revoked";

type LicenseRow = {
  device_id: string;
  status: string;
  plan: string;
  email: string;
  label: string;
  note: string;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
  last_seen_at: number | null;
  order_id: string;
  amount_cents: number;
  source: string;
};

export type LicenseView = {
  deviceId: string;
  status: StoredStatus;
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

/** Wrong logins tolerated before the dashboard locks itself for a while. */
const MAX_LOGIN_FAILURES = 6;

const LOCKOUT_MS = 10 * 60 * 1000;

function toView(row: LicenseRow): LicenseView {
  const expired = row.expires_at !== null && row.expires_at < Date.now();
  return {
    deviceId: row.device_id,
    status: row.status as StoredStatus,
    plan: row.plan,
    email: row.email,
    label: row.label,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    orderId: row.order_id,
    amountCents: row.amount_cents,
    source: row.source,
    expired,
  };
}

/**
 * Single global instance holding every licence and every settled order.
 * The Worker is the only caller; nothing here is reachable from the Internet
 * without passing through the entrypoint's auth checks first.
 */
export class Registry extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS licenses (
        device_id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'active',
        plan TEXT NOT NULL DEFAULT 'annual',
        email TEXT NOT NULL DEFAULT '',
        label TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER,
        last_seen_at INTEGER,
        order_id TEXT NOT NULL DEFAULT '',
        amount_cents INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'stripe'
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        plan TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )
    `);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = request.method === "POST" ? ((await request.json()) as Record<string, unknown>) : {};

    switch (url.pathname) {
      case "/status":
        return Response.json(this.status(String(body.deviceId ?? "")));
      case "/issue":
        return Response.json(this.issue(body));
      case "/order-seen":
        return Response.json({ known: this.orderKnown(String(body.orderId ?? "")) });
      case "/list":
        return Response.json({ licenses: this.list(), stats: this.stats() });
      case "/set-status":
        return Response.json(
          this.setStatus(String(body.deviceId ?? ""), String(body.status ?? "") as StoredStatus, String(body.note ?? "")),
        );
      case "/extend":
        return Response.json(this.extend(String(body.deviceId ?? ""), Number(body.days ?? 0)));
      case "/update":
        return Response.json(
          this.updateDetails(String(body.deviceId ?? ""), String(body.label ?? ""), String(body.email ?? "")),
        );
      case "/remove":
        this.ctx.storage.sql.exec("DELETE FROM licenses WHERE device_id = ?", String(body.deviceId ?? ""));
        return Response.json({ ok: true });
      case "/settings-get":
        return Response.json({ value: this.setting(String(body.key ?? "")) });
      case "/settings-put":
        this.putSetting(String(body.key ?? ""), String(body.value ?? ""));
        return Response.json({ ok: true });
      case "/login-guard":
        return Response.json(this.loginGuard(String(body.action ?? "check")));
      default:
        return new Response("not found", { status: 404 });
    }
  }

  /** Small key/value store for dashboard security settings (2FA, lockout). */
  private setting(key: string): string {
    const rows = this.ctx.storage.sql
      .exec<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)
      .toArray();
    return rows[0]?.value ?? "";
  }

  private putSetting(key: string, value: string): void {
    if (!key) return;
    this.ctx.storage.sql.exec(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
  }

  /**
   * Brute-force brake on the dashboard login. After [MAX_LOGIN_FAILURES] wrong
   * attempts the door stays shut for a few minutes, counted server-side so it
   * cannot be bypassed by clearing the browser.
   */
  private loginGuard(action: string): { blocked: boolean; retryInSeconds: number; failures: number } {
    const now = Date.now();
    const failures = Number(this.setting("login_failures")) || 0;
    const lockedUntil = Number(this.setting("login_locked_until")) || 0;

    if (action === "reset") {
      this.putSetting("login_failures", "0");
      this.putSetting("login_locked_until", "0");
      return { blocked: false, retryInSeconds: 0, failures: 0 };
    }

    if (action === "fail") {
      const next = failures + 1;
      this.putSetting("login_failures", String(next));
      if (next >= MAX_LOGIN_FAILURES) {
        this.putSetting("login_locked_until", String(now + LOCKOUT_MS));
        this.putSetting("login_failures", "0");
        return { blocked: true, retryInSeconds: Math.ceil(LOCKOUT_MS / 1000), failures: next };
      }
      return { blocked: false, retryInSeconds: 0, failures: next };
    }

    if (lockedUntil > now) {
      return { blocked: true, retryInSeconds: Math.ceil((lockedUntil - now) / 1000), failures };
    }
    return { blocked: false, retryInSeconds: 0, failures };
  }

  private find(deviceId: string): LicenseRow | null {
    const rows = this.ctx.storage.sql
      .exec<LicenseRow>("SELECT * FROM licenses WHERE device_id = ?", deviceId)
      .toArray();
    return rows[0] ?? null;
  }

  /** Read used by the Android app on every launch; also records the heartbeat. */
  private status(deviceId: string): {
    found: boolean;
    status: "active" | "suspended" | "revoked" | "expired" | "none";
    plan: string;
    expiresAt: number | null;
    note: string;
    serverTime: number;
  } {
    const row = this.find(deviceId);
    const serverTime = Date.now();
    if (!row) {
      return { found: false, status: "none", plan: "", expiresAt: null, note: "", serverTime };
    }
    this.ctx.storage.sql.exec("UPDATE licenses SET last_seen_at = ? WHERE device_id = ?", serverTime, deviceId);
    const view = toView(row);
    const status =
      view.status === "active" && view.expired ? "expired" : (view.status as "active" | "suspended" | "revoked");
    return {
      found: true,
      status,
      plan: view.plan,
      expiresAt: view.expiresAt,
      note: view.note,
      serverTime,
    };
  }

  private orderKnown(orderId: string): boolean {
    if (!orderId) return false;
    return (
      this.ctx.storage.sql.exec("SELECT order_id FROM orders WHERE order_id = ?", orderId).toArray().length > 0
    );
  }

  /**
   * Creates or renews a licence. An annual purchase on top of a still-valid
   * annual licence stacks onto the remaining time instead of truncating it.
   */
  private issue(body: Record<string, unknown>): { ok: boolean; license: LicenseView } {
    const deviceId = String(body.deviceId ?? "");
    const planId = String(body.plan ?? "annual") as PlanId;
    const plan = PLANS[planId] ?? PLANS.annual;
    const now = Date.now();
    const existing = this.find(deviceId);
    const orderId = String(body.orderId ?? "");
    const email = String(body.email ?? "");
    const label = String(body.label ?? "");
    const source = String(body.source ?? "stripe");
    const amountCents = Number(body.amountCents ?? plan.priceCents);

    let expiresAt: number | null = null;
    if (plan.durationDays !== null) {
      const base =
        existing?.expires_at && existing.expires_at > now && existing.status === "active"
          ? existing.expires_at
          : now;
      expiresAt = base + plan.durationDays * 24 * 60 * 60 * 1000;
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO licenses
         (device_id, status, plan, email, label, note, created_at, updated_at, expires_at, last_seen_at, order_id, amount_cents, source)
       VALUES (?, 'active', ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         status = 'active',
         plan = excluded.plan,
         email = CASE WHEN excluded.email <> '' THEN excluded.email ELSE licenses.email END,
         label = CASE WHEN excluded.label <> '' THEN excluded.label ELSE licenses.label END,
         note = '',
         updated_at = excluded.updated_at,
         expires_at = excluded.expires_at,
         order_id = excluded.order_id,
         amount_cents = excluded.amount_cents,
         source = excluded.source`,
      deviceId,
      planId,
      email,
      label,
      now,
      now,
      expiresAt,
      existing?.last_seen_at ?? null,
      orderId,
      amountCents,
      source,
    );

    if (orderId) {
      this.ctx.storage.sql.exec(
        `INSERT INTO orders (order_id, device_id, plan, amount_cents, currency, email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(order_id) DO NOTHING`,
        orderId,
        deviceId,
        planId,
        amountCents,
        plan.currency,
        email,
        now,
      );
    }

    const row = this.find(deviceId);
    return { ok: true, license: toView(row as LicenseRow) };
  }

  private setStatus(deviceId: string, status: StoredStatus, note: string): { ok: boolean } {
    if (status !== "active" && status !== "suspended" && status !== "revoked") return { ok: false };
    this.ctx.storage.sql.exec(
      "UPDATE licenses SET status = ?, note = ?, updated_at = ? WHERE device_id = ?",
      status,
      note,
      Date.now(),
      deviceId,
    );
    return { ok: true };
  }

  private extend(deviceId: string, days: number): { ok: boolean; expiresAt: number | null } {
    const row = this.find(deviceId);
    if (!row || !Number.isFinite(days)) return { ok: false, expiresAt: null };
    if (row.expires_at === null) return { ok: true, expiresAt: null };
    const base = row.expires_at > Date.now() ? row.expires_at : Date.now();
    const expiresAt = base + days * 24 * 60 * 60 * 1000;
    this.ctx.storage.sql.exec(
      "UPDATE licenses SET expires_at = ?, updated_at = ? WHERE device_id = ?",
      expiresAt,
      Date.now(),
      deviceId,
    );
    return { ok: true, expiresAt };
  }

  private updateDetails(deviceId: string, label: string, email: string): { ok: boolean } {
    this.ctx.storage.sql.exec(
      "UPDATE licenses SET label = ?, email = ?, updated_at = ? WHERE device_id = ?",
      label,
      email,
      Date.now(),
      deviceId,
    );
    return { ok: true };
  }

  private list(): LicenseView[] {
    return this.ctx.storage.sql
      .exec<LicenseRow>("SELECT * FROM licenses ORDER BY updated_at DESC LIMIT 2000")
      .toArray()
      .map(toView);
  }

  private stats(): {
    total: number;
    active: number;
    suspended: number;
    revoked: number;
    expired: number;
    revenueCents: number;
    revenueCents30d: number;
  } {
    const licenses = this.list();
    const orders = this.ctx.storage.sql
      .exec<{ amount_cents: number; created_at: number }>("SELECT amount_cents, created_at FROM orders")
      .toArray();
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return {
      total: licenses.length,
      active: licenses.filter((l) => l.status === "active" && !l.expired).length,
      suspended: licenses.filter((l) => l.status === "suspended").length,
      revoked: licenses.filter((l) => l.status === "revoked").length,
      expired: licenses.filter((l) => l.status === "active" && l.expired).length,
      revenueCents: orders.reduce((sum, o) => sum + o.amount_cents, 0),
      revenueCents30d: orders
        .filter((o) => o.created_at >= monthAgo)
        .reduce((sum, o) => sum + o.amount_cents, 0),
    };
  }
}

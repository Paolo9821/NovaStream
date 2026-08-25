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

/**
 * First contact of a device, kept server-side so the free window cannot be
 * restarted by wiping the app's data or reinstalling it.
 */
type TrialRow = {
  trial_id: string;
  started_at: number;
  last_seen_at: number;
  installs: number;
};

/** Length of the free window, mirroring the constant compiled into the app. */
const TRIAL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A device inside (or just out of) its free window, as listed in the dashboard. */
export type TrialView = {
  deviceId: string;
  aliases: string[];
  startedAt: number;
  lastSeenAt: number;
  /** How many times the app was installed again on this same device. */
  installs: number;
  expiresAt: number;
  expired: boolean;
  /** True once the device bought a licence, so it is no longer a prospect. */
  converted: boolean;
};

/** One settled purchase, kept so the revenue history survives everything else. */
export type OrderView = {
  orderId: string;
  deviceId: string;
  plan: string;
  amountCents: number;
  currency: string;
  email: string;
  createdAt: number;
};

/** Lifecycle of a support request as seen in the dashboard. */
export type TicketStatus = "new" | "open" | "closed";

type TicketRow = {
  id: string;
  created_at: number;
  updated_at: number;
  email: string;
  device_id: string;
  topic: string;
  message: string;
  status: string;
  lang: string;
  reply_note: string;
};

export type TicketView = {
  id: string;
  createdAt: number;
  updatedAt: number;
  email: string;
  deviceId: string;
  topic: string;
  message: string;
  status: TicketStatus;
  lang: string;
  note: string;
  /** Filled in when the device id matches a licence we already know about. */
  license: {
    status: StoredStatus;
    plan: string;
    expiresAt: number | null;
    expired: boolean;
  } | null;
};

export type LicenseView = {
  deviceId: string;
  /** Other identifiers that unlock this same licence (typically the MAC). */
  aliases: string[];
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

/** Wrong attempts older than this stop counting: a typo last week is not an attack. */
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** Support requests accepted per minute across the whole site, to blunt spam floods. */
const MAX_TICKETS_PER_MINUTE = 12;

/** Oldest requests are dropped past this, so storage cannot grow without bound. */
const MAX_TICKETS_KEPT = 500;

/** Drops blanks and duplicates while keeping the caller's order of preference. */
function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/**
 * Every name a device answers to, most specific first: the id the app sends,
 * then the MAC and any other identifier the Worker passed along.
 */
function identifiersOf(body: Record<string, unknown>): string[] {
  const extra = Array.isArray(body.identifiers) ? body.identifiers.map((value) => String(value)) : [];
  return unique([String(body.deviceId ?? ""), String(body.mac ?? ""), ...extra]);
}

function toView(row: LicenseRow, aliases: string[] = []): LicenseView {
  const expired = row.expires_at !== null && row.expires_at < Date.now();
  return {
    deviceId: row.device_id,
    aliases,
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
    // A device is known by two names: the MAC printed on the box (what customers
    // type on the site) and the ANDROID_ID the app sends. Whichever one paid for
    // the licence, both must open it — that is what this table records.
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS device_aliases (
        alias TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(
      "CREATE INDEX IF NOT EXISTS idx_device_aliases_device ON device_aliases (device_id)",
    );
    // The free window is anchored here rather than on the device: local storage
    // disappears with an uninstall, and a customer who reinstalls would
    // otherwise be handed a brand-new trial every time.
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS trials (
        trial_id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        installs INTEGER NOT NULL DEFAULT 1
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS trial_aliases (
        alias TEXT PRIMARY KEY,
        trial_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(
      "CREATE INDEX IF NOT EXISTS idx_trial_aliases_trial ON trial_aliases (trial_id)",
    );
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        device_id TEXT NOT NULL DEFAULT '',
        topic TEXT NOT NULL DEFAULT 'other',
        message TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'new',
        lang TEXT NOT NULL DEFAULT '',
        reply_note TEXT NOT NULL DEFAULT ''
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
        return Response.json(this.status(identifiersOf(body), body.fresh === true));
      case "/issue":
        return Response.json(this.issue(body));
      case "/order-seen":
        return Response.json({ known: this.orderKnown(String(body.orderId ?? "")) });
      case "/list":
        return Response.json({
          licenses: this.list(),
          stats: this.stats(),
          trials: this.trialList(),
          orders: this.orderHistory(),
        });
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
      case "/remove": {
        const deviceId = String(body.deviceId ?? "");
        this.ctx.storage.sql.exec("DELETE FROM licenses WHERE device_id = ?", deviceId);
        // Free the MAC too, otherwise it would keep pointing at a deleted licence.
        this.ctx.storage.sql.exec(
          "DELETE FROM device_aliases WHERE device_id = ? OR alias = ?",
          deviceId,
          deviceId,
        );
        return Response.json({ ok: true });
      }
      case "/settings-get":
        return Response.json({ value: this.setting(String(body.key ?? "")) });
      case "/settings-put":
        this.putSetting(String(body.key ?? ""), String(body.value ?? ""));
        return Response.json({ ok: true });
      case "/login-guard":
        return Response.json(this.loginGuard(String(body.action ?? "check")));
      case "/ticket-create":
        return Response.json(this.createTicket(body));
      case "/ticket-list":
        return Response.json({ tickets: this.tickets(), openCount: this.openTicketCount() });
      case "/ticket-status":
        return Response.json(
          this.setTicketStatus(String(body.id ?? ""), String(body.status ?? "") as TicketStatus, String(body.note ?? "")),
        );
      case "/ticket-remove":
        this.ctx.storage.sql.exec("DELETE FROM tickets WHERE id = ?", String(body.id ?? ""));
        return Response.json({ ok: true });
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
    const lockedUntil = Number(this.setting("login_locked_until")) || 0;
    const lastFailure = Number(this.setting("login_last_failure")) || 0;
    const stale = now - lastFailure > FAILURE_WINDOW_MS;
    const failures = stale ? 0 : Number(this.setting("login_failures")) || 0;

    if (action === "reset") {
      this.putSetting("login_failures", "0");
      this.putSetting("login_locked_until", "0");
      return { blocked: false, retryInSeconds: 0, failures: 0 };
    }

    if (action === "fail") {
      const next = failures + 1;
      this.putSetting("login_last_failure", String(now));
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

  /**
   * Stores one support request. Everything arrives already trimmed and length
   * limited by the Worker; here we only guard against flooding.
   */
  private createTicket(body: Record<string, unknown>): { ok: boolean; id?: string; error?: string } {
    const now = Date.now();
    const recent = this.ctx.storage.sql
      .exec<{ n: number }>("SELECT COUNT(*) AS n FROM tickets WHERE created_at > ?", now - 60_000)
      .toArray()[0]?.n ?? 0;
    if (recent >= MAX_TICKETS_PER_MINUTE) {
      return { ok: false, error: "too many requests" };
    }

    const id = `t_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.ctx.storage.sql.exec(
      `INSERT INTO tickets (id, created_at, updated_at, email, device_id, topic, message, status, lang, reply_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, '')`,
      id,
      now,
      now,
      String(body.email ?? ""),
      String(body.deviceId ?? ""),
      String(body.topic ?? "other"),
      String(body.message ?? ""),
      String(body.lang ?? ""),
    );

    // Keep the table bounded: closed and oldest requests fall off the end.
    this.ctx.storage.sql.exec(
      `DELETE FROM tickets WHERE id IN (
         SELECT id FROM tickets ORDER BY created_at DESC LIMIT -1 OFFSET ?
       )`,
      MAX_TICKETS_KEPT,
    );
    return { ok: true, id };
  }

  private openTicketCount(): number {
    return (
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM tickets WHERE status <> 'closed'")
        .toArray()[0]?.n ?? 0
    );
  }

  /** Newest first, each one already matched against the licence registry. */
  private tickets(): TicketView[] {
    return this.ctx.storage.sql
      .exec<TicketRow>("SELECT * FROM tickets ORDER BY created_at DESC LIMIT 500")
      .toArray()
      .map((row) => {
        // Customers write whichever identifier they have to hand, so a ticket
        // quoting a MAC still shows the licence behind it.
        const license = row.device_id ? this.resolve([row.device_id]) : null;
        return {
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          email: row.email,
          deviceId: row.device_id,
          topic: row.topic,
          message: row.message,
          status: row.status as TicketStatus,
          lang: row.lang,
          note: row.reply_note,
          license: license
            ? {
                status: license.status as StoredStatus,
                plan: license.plan,
                expiresAt: license.expires_at,
                expired: license.expires_at !== null && license.expires_at < Date.now(),
              }
            : null,
        };
      });
  }

  private setTicketStatus(id: string, status: TicketStatus, note: string): { ok: boolean } {
    if (status !== "new" && status !== "open" && status !== "closed") return { ok: false };
    this.ctx.storage.sql.exec(
      "UPDATE tickets SET status = ?, reply_note = ?, updated_at = ? WHERE id = ?",
      status,
      note,
      Date.now(),
      id,
    );
    return { ok: true };
  }

  private find(deviceId: string): LicenseRow | null {
    if (!deviceId) return null;
    const rows = this.ctx.storage.sql
      .exec<LicenseRow>("SELECT * FROM licenses WHERE device_id = ?", deviceId)
      .toArray();
    return rows[0] ?? null;
  }

  /** Every extra name this licence answers to, newest last. */
  private aliasesOf(deviceId: string): string[] {
    return this.ctx.storage.sql
      .exec<{ alias: string }>(
        "SELECT alias FROM device_aliases WHERE device_id = ? ORDER BY created_at",
        deviceId,
      )
      .toArray()
      .map((row) => row.alias);
  }

  private findByAlias(identifier: string): LicenseRow | null {
    if (!identifier) return null;
    const target = this.ctx.storage.sql
      .exec<{ device_id: string }>("SELECT device_id FROM device_aliases WHERE alias = ?", identifier)
      .toArray()[0]?.device_id;
    return target ? this.find(target) : null;
  }

  /**
   * Finds the licence behind any of the names a device answers to. A purchase
   * made against the MAC is therefore honoured when the app asks with its
   * ANDROID_ID, and the other way round.
   */
  private resolve(identifiers: string[]): LicenseRow | null {
    const ids = unique(identifiers);
    for (const id of ids) {
      const row = this.find(id);
      if (row) return row;
    }
    for (const id of ids) {
      const row = this.findByAlias(id);
      if (row) return row;
    }
    return null;
  }

  /**
   * Records the other names of a device the first time it presents them, so the
   * next lookup is a direct hit. First claim wins and is never reassigned: a MAC
   * copied from someone else's box cannot pull their licence onto a second
   * device, and an identifier that already owns a licence is left alone.
   */
  private link(deviceId: string, identifiers: string[]): void {
    const now = Date.now();
    for (const id of unique(identifiers)) {
      if (id === deviceId || this.find(id)) continue;
      this.ctx.storage.sql.exec(
        `INSERT INTO device_aliases (alias, device_id, created_at) VALUES (?, ?, ?)
         ON CONFLICT(alias) DO NOTHING`,
        id,
        deviceId,
        now,
      );
    }
  }

  private findTrial(identifiers: string[]): TrialRow | null {
    const ids = unique(identifiers);
    for (const id of ids) {
      const row = this.ctx.storage.sql
        .exec<TrialRow>("SELECT * FROM trials WHERE trial_id = ?", id)
        .toArray()[0];
      if (row) return row;
    }
    for (const id of ids) {
      const target = this.ctx.storage.sql
        .exec<{ trial_id: string }>("SELECT trial_id FROM trial_aliases WHERE alias = ?", id)
        .toArray()[0]?.trial_id;
      if (!target) continue;
      const row = this.ctx.storage.sql
        .exec<TrialRow>("SELECT * FROM trials WHERE trial_id = ?", target)
        .toArray()[0];
      if (row) return row;
    }
    return null;
  }

  /** Records the other names of a device so any of them finds the same trial. */
  private linkTrial(trialId: string, identifiers: string[]): void {
    const now = Date.now();
    for (const id of unique(identifiers)) {
      if (id === trialId) continue;
      this.ctx.storage.sql.exec(
        `INSERT INTO trial_aliases (alias, trial_id, created_at) VALUES (?, ?, ?)
         ON CONFLICT(alias) DO NOTHING`,
        id,
        trialId,
        now,
      );
    }
  }

  /**
   * Start of the free window for this device, created on first contact and never
   * moved afterwards. [fresh] is set by the app when it has no local record of
   * its own — a reinstall — and only bumps a counter, so the clock keeps running
   * from the original date instead of starting over.
   */
  private trial(identifiers: string[], fresh: boolean): { startedAt: number; installs: number } | null {
    const ids = unique(identifiers);
    if (ids.length === 0) return null;
    const now = Date.now();
    const existing = this.findTrial(ids);

    if (existing) {
      this.linkTrial(existing.trial_id, ids);
      const installs = existing.installs + (fresh ? 1 : 0);
      this.ctx.storage.sql.exec(
        "UPDATE trials SET last_seen_at = ?, installs = ? WHERE trial_id = ?",
        now,
        installs,
        existing.trial_id,
      );
      return { startedAt: existing.started_at, installs };
    }

    const trialId = ids[0];
    this.ctx.storage.sql.exec(
      `INSERT INTO trials (trial_id, started_at, last_seen_at, installs) VALUES (?, ?, ?, 1)
       ON CONFLICT(trial_id) DO NOTHING`,
      trialId,
      now,
      now,
    );
    this.linkTrial(trialId, ids);
    return { startedAt: now, installs: 1 };
  }

  private trialAliasesOf(trialId: string): string[] {
    return this.ctx.storage.sql
      .exec<{ alias: string }>(
        "SELECT alias FROM trial_aliases WHERE trial_id = ? ORDER BY created_at",
        trialId,
      )
      .toArray()
      .map((row) => row.alias);
  }

  /** Newest first, each row already told apart from the paying customers. */
  private trialList(): TrialView[] {
    const now = Date.now();
    return this.ctx.storage.sql
      .exec<TrialRow>("SELECT * FROM trials ORDER BY started_at DESC LIMIT 2000")
      .toArray()
      .map((row) => {
        const aliases = this.trialAliasesOf(row.trial_id);
        const expiresAt = row.started_at + TRIAL_DAYS * DAY_MS;
        return {
          deviceId: row.trial_id,
          aliases,
          startedAt: row.started_at,
          lastSeenAt: row.last_seen_at,
          installs: row.installs,
          expiresAt,
          expired: expiresAt < now,
          converted: this.resolve([row.trial_id, ...aliases]) !== null,
        };
      });
  }

  /**
   * Every purchase ever settled, oldest first. This is the source the revenue
   * chart reads, which is why nothing here is ever pruned: the history has to
   * stay browsable months and years later.
   */
  private orderHistory(): OrderView[] {
    return this.ctx.storage.sql
      .exec<{
        order_id: string;
        device_id: string;
        plan: string;
        amount_cents: number;
        currency: string;
        email: string;
        created_at: number;
      }>("SELECT * FROM orders ORDER BY created_at")
      .toArray()
      .map((row) => ({
        orderId: row.order_id,
        deviceId: row.device_id,
        plan: row.plan,
        amountCents: row.amount_cents,
        currency: row.currency,
        email: row.email,
        createdAt: row.created_at,
      }));
  }

  /** Read used by the Android app on every launch; also records the heartbeat. */
  private status(
    identifiers: string[],
    fresh = false,
  ): {
    found: boolean;
    status: "active" | "suspended" | "revoked" | "expired" | "none";
    plan: string;
    expiresAt: number | null;
    note: string;
    deviceId: string;
    serverTime: number;
    trialStartedAt: number | null;
    trialInstalls: number;
  } {
    const row = this.resolve(identifiers);
    const serverTime = Date.now();
    // Recorded for paid devices too: the anchor must still be there if the
    // licence later expires, so nobody falls back into a second free week.
    const trial = this.trial(identifiers, fresh);
    if (!row) {
      return {
        found: false,
        status: "none",
        plan: "",
        expiresAt: null,
        note: "",
        deviceId: unique(identifiers)[0] ?? "",
        serverTime,
        trialStartedAt: trial?.startedAt ?? null,
        trialInstalls: trial?.installs ?? 0,
      };
    }
    this.link(row.device_id, identifiers);
    this.ctx.storage.sql.exec(
      "UPDATE licenses SET last_seen_at = ? WHERE device_id = ?",
      serverTime,
      row.device_id,
    );
    const view = toView(row);
    const status =
      view.status === "active" && view.expired ? "expired" : (view.status as "active" | "suspended" | "revoked");
    return {
      found: true,
      status,
      plan: view.plan,
      expiresAt: view.expiresAt,
      note: view.note,
      deviceId: row.device_id,
      serverTime,
      trialStartedAt: trial?.startedAt ?? null,
      trialInstalls: trial?.installs ?? 0,
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

    // A licence granted for one name also covers the other names presented with it.
    this.link(deviceId, identifiersOf(body));

    const row = this.find(deviceId);
    return { ok: true, license: toView(row as LicenseRow, this.aliasesOf(deviceId)) };
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
      .map((row) => toView(row, this.aliasesOf(row.device_id)));
  }

  private stats(): {
    total: number;
    active: number;
    suspended: number;
    revoked: number;
    expired: number;
    lifetime: number;
    subscription: number;
    trialsActive: number;
    trialsExpired: number;
    reinstalls: number;
    revenueCents: number;
    revenueCents30d: number;
  } {
    const licenses = this.list();
    const live = licenses.filter((l) => l.status === "active" && !l.expired);
    const trials = this.trialList().filter((t) => !t.converted);
    const orders = this.ctx.storage.sql
      .exec<{ amount_cents: number; created_at: number }>("SELECT amount_cents, created_at FROM orders")
      .toArray();
    const monthAgo = Date.now() - 30 * DAY_MS;
    return {
      total: licenses.length,
      active: live.length,
      suspended: licenses.filter((l) => l.status === "suspended").length,
      revoked: licenses.filter((l) => l.status === "revoked").length,
      expired: licenses.filter((l) => l.status === "active" && l.expired).length,
      lifetime: live.filter((l) => l.plan === "lifetime").length,
      subscription: live.filter((l) => l.plan !== "lifetime").length,
      trialsActive: trials.filter((t) => !t.expired).length,
      trialsExpired: trials.filter((t) => t.expired).length,
      // Every extra install beyond the first, across all devices: a rough
      // measure of how often the free window is being probed.
      reinstalls: trials.reduce((sum, t) => sum + Math.max(0, t.installs - 1), 0),
      revenueCents: orders.reduce((sum, o) => sum + o.amount_cents, 0),
      revenueCents30d: orders
        .filter((o) => o.created_at >= monthAgo)
        .reduce((sum, o) => sum + o.amount_cents, 0),
    };
  }
}

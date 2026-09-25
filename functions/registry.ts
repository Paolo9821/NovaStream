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

/** Playlists one device can hold through the website, a guard against abuse. */
const MAX_DEVICE_PLAYLISTS = 20;

/** Wrong device keys tolerated before that device refuses the website for a while. */
const MAX_KEY_FAILURES = 8;

const KEY_LOCKOUT_MS = 15 * 60 * 1000;

/** Same look-alike-free alphabet as the CAPTCHA: nothing to confuse on a TV. */
const KEY_ALPHABET = "ACDEFHJKLMNPQRTUVWXY23456789";

const KEY_LENGTH = 6;

/** A website key lives five minutes at most, and dies earlier the moment it is used. */
const KEY_TTL_MS = 5 * 60 * 1000;

/** A website session opened with a key ends after this much inactivity... */
const SESSION_IDLE_MS = 15 * 60 * 1000;

/** ...and in any case after this long, however active it is. */
const SESSION_MAX_MS = 60 * 60 * 1000;

type DeviceRow = {
  device_id: string;
  mac: string;
  device_key: string;
  created_at: number;
  last_seen_at: number;
  key_failures: number;
  locked_until: number;
  key_issued_at: number;
  last_open_at: number;
};

type DeviceSessionRow = {
  token_hash: string;
  device_id: string;
  created_at: number;
  last_used_at: number;
  expires_at: number;
};

type AuthFailure = { ok: false; error: string; retryInSeconds?: number };

type DevicePlaylistRow = {
  id: string;
  device_id: string;
  name: string;
  type: string;
  host: string;
  sealed: string;
  origin: string;
  status: string;
  created_at: number;
  updated_at: number;
};

/**
 * A playlist as the website shows it. Credentials are never part of this: the
 * page only ever sees a name, the kind and the server host.
 */
export type DevicePlaylistView = {
  id: string;
  name: string;
  type: "m3u" | "xtream";
  host: string;
  /** pending: waiting for the device · installed: on it · deleting: being removed. */
  status: "pending" | "installed" | "deleting";
  origin: "web" | "app";
  createdAt: number;
};

/** What the app reports about a playlist it holds, never with credentials. */
type ReportedPlaylist = { id: string; name: string; type: string; host: string };

function newDeviceKey(): string {
  const bytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join("");
}

function reportedOf(body: Record<string, unknown>): ReportedPlaylist[] {
  if (!Array.isArray(body.playlists)) return [];
  return body.playlists
    .slice(0, 100)
    .map((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      return {
        id: String(item.id ?? "").trim().slice(0, 64),
        name: String(item.name ?? "").trim().slice(0, 80),
        type: String(item.type ?? "").toLowerCase() === "xtream" ? "xtream" : "m3u",
        host: String(item.host ?? "").trim().slice(0, 120),
      };
    })
    .filter((item) => item.id.length > 0);
}

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
    // Devices that can be managed from the website. The key is shown inside the
    // app and asked for on the site, so knowing a MAC alone opens nothing.
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY,
        mac TEXT NOT NULL DEFAULT '',
        device_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        key_failures INTEGER NOT NULL DEFAULT 0,
        locked_until INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS idx_devices_mac ON devices (mac)");
    // Added with the rotating key: older rows start at 0, i.e. already expired.
    for (const column of ["key_issued_at", "last_open_at"]) {
      try {
        this.ctx.storage.sql.exec(`ALTER TABLE devices ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`);
      } catch {
        /* column already there */
      }
    }
    // The website never keeps the key: using it opens a short session instead,
    // stored here only as a hash. One session per device at a time.
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS device_sessions (
        token_hash TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
    // `sealed` holds the encrypted credentials of a playlist sent from the site
    // only until the device has collected it; it is blanked right after.
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS device_playlists (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'm3u',
        host TEXT NOT NULL DEFAULT '',
        sealed TEXT NOT NULL DEFAULT '',
        origin TEXT NOT NULL DEFAULT 'web',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(
      "CREATE INDEX IF NOT EXISTS idx_device_playlists_device ON device_playlists (device_id)",
    );
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS captcha_used (
        nonce TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
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
      case "/device-sync":
        return Response.json(
          this.deviceSync(String(body.deviceId ?? ""), String(body.mac ?? ""), reportedOf(body)),
        );
      case "/device-open":
        return Response.json(
          this.deviceOpen(String(body.identifier ?? ""), String(body.key ?? ""), String(body.sessionHash ?? "")),
        );
      case "/device-view":
        return Response.json(this.deviceView(String(body.identifier ?? ""), String(body.sessionHash ?? "")));
      case "/device-playlist-add":
        return Response.json(this.devicePlaylistAdd(body));
      case "/device-playlist-remove":
        return Response.json(
          this.devicePlaylistRemove(
            String(body.identifier ?? ""),
            String(body.sessionHash ?? ""),
            String(body.id ?? ""),
          ),
        );
      case "/captcha-burn":
        return Response.json({
          fresh: this.burnCaptcha(String(body.nonce ?? ""), Number(body.expiresAt ?? 0)),
        });
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

  // ---- Playlists managed from the website ---------------------------------

  private deviceById(deviceId: string): DeviceRow | null {
    if (!deviceId) return null;
    return (
      this.ctx.storage.sql.exec<DeviceRow>("SELECT * FROM devices WHERE device_id = ?", deviceId).toArray()[0] ??
      null
    );
  }

  /** Customers type whichever name they have: the MAC or the device id. */
  private deviceByIdentifier(identifier: string): DeviceRow | null {
    if (!identifier) return null;
    return (
      this.deviceById(identifier) ??
      this.ctx.storage.sql
        .exec<DeviceRow>("SELECT * FROM devices WHERE mac = ? ORDER BY last_seen_at DESC LIMIT 1", identifier)
        .toArray()[0] ??
      null
    );
  }

  private keyIsLive(device: DeviceRow, now: number): boolean {
    return Boolean(device.device_key) && device.key_issued_at > 0 && now - device.key_issued_at < KEY_TTL_MS;
  }

  /** Draws a fresh key, never the same as the one it replaces. */
  private rotateKey(device: DeviceRow, now: number): { key: string; issuedAt: number } {
    let key = newDeviceKey();
    while (key === device.device_key) key = newDeviceKey();
    this.ctx.storage.sql.exec(
      "UPDATE devices SET device_key = ?, key_issued_at = ? WHERE device_id = ?",
      key,
      now,
      device.device_id,
    );
    return { key, issuedAt: now };
  }

  /**
   * Checks the key typed on the website and, when it is right, burns it on the
   * spot and opens a session for that browser instead. A wrong key counts
   * against that device only, and too many of them shut the door for a while,
   * so the key cannot be guessed by trying. Unknown devices, wrong keys and
   * expired or already used keys all get the same answer.
   */
  private openWithKey(
    identifier: string,
    key: string,
    sessionHash: string,
  ): { ok: true; device: DeviceRow } | AuthFailure {
    const device = this.deviceByIdentifier(identifier);
    if (!device || !sessionHash) return { ok: false, error: "wrong device or key" };
    const now = Date.now();
    if (device.locked_until > now) {
      return {
        ok: false,
        error: "too many attempts",
        retryInSeconds: Math.ceil((device.locked_until - now) / 1000),
      };
    }
    const typed = key.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (typed === device.device_key && !this.keyIsLive(device, now)) {
      // The right key, just too late: not a guess, so it is not held against anyone.
      this.rotateKey(device, now);
      return { ok: false, error: "wrong device or key" };
    }
    if (typed !== device.device_key) {
      const failures = device.key_failures + 1;
      const locked = failures >= MAX_KEY_FAILURES;
      this.ctx.storage.sql.exec(
        "UPDATE devices SET key_failures = ?, locked_until = ? WHERE device_id = ?",
        locked ? 0 : failures,
        locked ? now + KEY_LOCKOUT_MS : 0,
        device.device_id,
      );
      if (locked) {
        return { ok: false, error: "too many attempts", retryInSeconds: Math.ceil(KEY_LOCKOUT_MS / 1000) };
      }
      return { ok: false, error: "wrong device or key" };
    }

    // Single use: the key dies the moment it opens the device.
    this.rotateKey(device, now);
    this.ctx.storage.sql.exec(
      "UPDATE devices SET key_failures = 0, last_open_at = ? WHERE device_id = ?",
      now,
      device.device_id,
    );
    this.ctx.storage.sql.exec(
      "DELETE FROM device_sessions WHERE device_id = ? OR expires_at < ? OR created_at < ?",
      device.device_id,
      now,
      now - SESSION_MAX_MS,
    );
    this.ctx.storage.sql.exec(
      `INSERT INTO device_sessions (token_hash, device_id, created_at, last_used_at, expires_at)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT(token_hash) DO NOTHING`,
      sessionHash,
      device.device_id,
      now,
      now,
      now + SESSION_IDLE_MS,
    );
    return { ok: true, device };
  }

  /** Lets a browser that already used a key keep working until its session ends. */
  private authorizeSession(identifier: string, sessionHash: string): { ok: true; device: DeviceRow } | AuthFailure {
    const expired: AuthFailure = { ok: false, error: "session expired" };
    if (!sessionHash) return expired;
    const now = Date.now();
    const row = this.ctx.storage.sql
      .exec<DeviceSessionRow>("SELECT * FROM device_sessions WHERE token_hash = ?", sessionHash)
      .toArray()[0];
    if (!row) return expired;
    if (row.expires_at < now || now - row.created_at > SESSION_MAX_MS) {
      this.ctx.storage.sql.exec("DELETE FROM device_sessions WHERE token_hash = ?", sessionHash);
      return expired;
    }
    const device = this.deviceById(row.device_id);
    if (!device) return expired;
    if (identifier && identifier !== device.device_id && identifier !== device.mac) return expired;
    this.ctx.storage.sql.exec(
      "UPDATE device_sessions SET last_used_at = ?, expires_at = ? WHERE token_hash = ?",
      now,
      Math.min(now + SESSION_IDLE_MS, row.created_at + SESSION_MAX_MS),
      sessionHash,
    );
    return { ok: true, device };
  }

  private devicePlaylists(deviceId: string): DevicePlaylistView[] {
    return this.ctx.storage.sql
      .exec<DevicePlaylistRow>(
        "SELECT * FROM device_playlists WHERE device_id = ? ORDER BY created_at",
        deviceId,
      )
      .toArray()
      .map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type === "xtream" ? "xtream" : "m3u",
        host: row.host,
        status: row.status === "installed" || row.status === "deleting" ? row.status : "pending",
        origin: row.origin === "app" ? "app" : "web",
        createdAt: row.created_at,
      }));
  }

  /**
   * Called by the app. Registers the device on first contact, reconciles what
   * it holds with what the website asked for, and hands back the playlists to
   * install and the ones to remove. The app calls it again after applying the
   * answer, which is what confirms the delivery and wipes the credentials here.
   */
  private deviceSync(
    deviceId: string,
    mac: string,
    reported: ReportedPlaylist[],
  ): {
    ok: boolean;
    key: string;
    keyExpiresAt: number;
    lastOpenAt: number;
    serverTime: number;
    install: { id: string; sealed: string }[];
    remove: string[];
  } {
    if (!deviceId) {
      return { ok: false, key: "", keyExpiresAt: 0, lastOpenAt: 0, serverTime: Date.now(), install: [], remove: [] };
    }
    const now = Date.now();
    let device = this.deviceById(deviceId);
    if (!device) {
      this.ctx.storage.sql.exec(
        `INSERT INTO devices (device_id, mac, device_key, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(device_id) DO NOTHING`,
        deviceId,
        mac,
        "",
        now,
        now,
      );
      device = this.deviceById(deviceId) as DeviceRow;
    } else {
      this.ctx.storage.sql.exec(
        "UPDATE devices SET last_seen_at = ?, mac = CASE WHEN ? <> '' THEN ? ELSE mac END WHERE device_id = ?",
        now,
        mac,
        mac,
        deviceId,
      );
    }

    const rows = this.ctx.storage.sql
      .exec<DevicePlaylistRow>("SELECT * FROM device_playlists WHERE device_id = ?", deviceId)
      .toArray();
    const known = new Map(rows.map((row) => [row.id, row]));
    const reportedIds = new Set(reported.map((item) => item.id));

    for (const item of reported) {
      const row = known.get(item.id);
      if (!row) {
        // Added by hand inside the app: listed on the site so it can be removed there too.
        this.ctx.storage.sql.exec(
          `INSERT INTO device_playlists (id, device_id, name, type, host, sealed, origin, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, '', 'app', 'installed', ?, ?) ON CONFLICT(id) DO NOTHING`,
          item.id,
          deviceId,
          item.name,
          item.type,
          item.host,
          now,
          now,
        );
      } else if (row.status === "pending") {
        // The device has it now: the credentials have nothing left to do here.
        this.ctx.storage.sql.exec(
          "UPDATE device_playlists SET status = 'installed', sealed = '', updated_at = ? WHERE id = ?",
          now,
          item.id,
        );
      } else if (row.status === "installed" && (row.name !== item.name || row.host !== item.host)) {
        this.ctx.storage.sql.exec(
          "UPDATE device_playlists SET name = ?, host = ?, updated_at = ? WHERE id = ?",
          item.name,
          item.host,
          now,
          item.id,
        );
      }
    }

    for (const row of rows) {
      if (reportedIds.has(row.id)) continue;
      // Removed on the device (by hand, or because the site asked): forget it.
      if (row.status === "installed" || row.status === "deleting") {
        this.ctx.storage.sql.exec("DELETE FROM device_playlists WHERE id = ?", row.id);
      }
    }

    const install = rows
      .filter((row) => row.status === "pending" && !reportedIds.has(row.id) && row.sealed)
      .map((row) => ({ id: row.id, sealed: row.sealed }));
    const remove = rows
      .filter((row) => row.status === "deleting" && reportedIds.has(row.id))
      .map((row) => row.id);

    // Five minutes are up (or it has never had one): the screen gets a new key.
    const current = this.keyIsLive(device, now)
      ? { key: device.device_key, issuedAt: device.key_issued_at }
      : this.rotateKey(device, now);

    return {
      ok: true,
      key: current.key,
      keyExpiresAt: current.issuedAt + KEY_TTL_MS,
      lastOpenAt: device.last_open_at,
      serverTime: now,
      install,
      remove,
    };
  }

  private viewOf(device: DeviceRow): { ok: true; lastSeenAt: number; playlists: DevicePlaylistView[]; limit: number } {
    return {
      ok: true,
      lastSeenAt: device.last_seen_at,
      playlists: this.devicePlaylists(device.device_id),
      limit: MAX_DEVICE_PLAYLISTS,
    };
  }

  private deviceOpen(identifier: string, key: string, sessionHash: string) {
    const auth = this.openWithKey(identifier, key, sessionHash);
    if (!auth.ok) return auth;
    return { ...this.viewOf(auth.device), sessionExpiresAt: Date.now() + SESSION_IDLE_MS };
  }

  private deviceView(identifier: string, sessionHash: string) {
    const auth = this.authorizeSession(identifier, sessionHash);
    if (!auth.ok) return auth;
    return this.viewOf(auth.device);
  }

  private devicePlaylistAdd(body: Record<string, unknown>): {
    ok: boolean;
    error?: string;
    retryInSeconds?: number;
    playlists?: DevicePlaylistView[];
  } {
    const auth = this.authorizeSession(String(body.identifier ?? ""), String(body.sessionHash ?? ""));
    if (!auth.ok) return auth;
    const deviceId = auth.device.device_id;
    const count =
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM device_playlists WHERE device_id = ?", deviceId)
        .toArray()[0]?.n ?? 0;
    if (count >= MAX_DEVICE_PLAYLISTS) return { ok: false, error: "too many playlists" };
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO device_playlists (id, device_id, name, type, host, sealed, origin, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'web', 'pending', ?, ?)`,
      String(body.id ?? ""),
      deviceId,
      String(body.name ?? ""),
      String(body.type ?? "m3u") === "xtream" ? "xtream" : "m3u",
      String(body.host ?? ""),
      String(body.sealed ?? ""),
      now,
      now,
    );
    return { ok: true, playlists: this.devicePlaylists(deviceId) };
  }

  /**
   * A playlist the device has not collected yet simply disappears. One already
   * on the device is flagged, and the app removes it at its next check.
   */
  private devicePlaylistRemove(identifier: string, sessionHash: string, id: string): {
    ok: boolean;
    error?: string;
    retryInSeconds?: number;
    playlists?: DevicePlaylistView[];
  } {
    const auth = this.authorizeSession(identifier, sessionHash);
    if (!auth.ok) return auth;
    const deviceId = auth.device.device_id;
    const row = this.ctx.storage.sql
      .exec<DevicePlaylistRow>("SELECT * FROM device_playlists WHERE id = ? AND device_id = ?", id, deviceId)
      .toArray()[0];
    if (row) {
      if (row.status === "pending") {
        this.ctx.storage.sql.exec("DELETE FROM device_playlists WHERE id = ?", id);
      } else {
        this.ctx.storage.sql.exec(
          "UPDATE device_playlists SET status = 'deleting', updated_at = ? WHERE id = ?",
          Date.now(),
          id,
        );
      }
    }
    return { ok: true, playlists: this.devicePlaylists(deviceId) };
  }

  /** True the first time a CAPTCHA is used; any later attempt with it is refused. */
  private burnCaptcha(nonce: string, expiresAt: number): boolean {
    if (!nonce) return false;
    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM captcha_used WHERE expires_at < ?", now);
    const seen = this.ctx.storage.sql.exec("SELECT nonce FROM captcha_used WHERE nonce = ?", nonce).toArray();
    if (seen.length > 0) return false;
    this.ctx.storage.sql.exec(
      "INSERT INTO captcha_used (nonce, expires_at) VALUES (?, ?)",
      nonce,
      Number.isFinite(expiresAt) && expiresAt > now ? expiresAt : now + 15 * 60 * 1000,
    );
    return true;
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

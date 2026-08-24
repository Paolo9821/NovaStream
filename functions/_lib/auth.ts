const encoder = new TextEncoder();

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SESSION_MS = 12 * 60 * 60 * 1000;

/**
 * Issues an opaque `<expiry>.<hmac>` dashboard session token. The signature
 * covers the owner name too, so renaming the account invalidates old sessions.
 */
export async function issueToken(secret: string, username: string): Promise<string> {
  const expiry = String(Date.now() + SESSION_MS);
  return `${expiry}.${await hmacSha256(secret, `${expiry}|${username}`)}`;
}

export async function verifyToken(
  secret: string,
  username: string,
  token: string | null,
): Promise<boolean> {
  if (!token || !secret) return false;
  const [expiry, signature] = token.split(".");
  if (!expiry || !signature) return false;
  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return timingSafeEqual(await hmacSha256(secret, `${expiry}|${username}`), signature);
}

function timingSafeEqual(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

/** Constant-time-ish comparison for the owner password. */
export function passwordMatches(expected: string, provided: string): boolean {
  if (!expected) return false;
  const a = encoder.encode(expected);
  const b = encoder.encode(provided);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Owner names are compared case-insensitively, trimmed, like every login form. */
export function usernameMatches(expected: string, provided: string): boolean {
  return expected.trim().toLowerCase() === provided.trim().toLowerCase();
}

// ---- TOTP (RFC 6238) -------------------------------------------------------
// Standard 30-second SHA-1 codes: works with Authy, Google Authenticator,
// 1Password, Microsoft Authenticator and every other authenticator app.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** How long one code stays valid, in seconds. */
export const TOTP_PERIOD_SECONDS = 30;

/** Codes from the neighbouring windows are accepted, for clock drift. */
const TOTP_DRIFT_STEPS = 1;

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(secret: string): Uint8Array | null {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (!clean) return null;
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

/** Fresh 160-bit shared secret, in the base32 form authenticator apps expect. */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

async function totpCode(secretBytes: Uint8Array, step: number): Promise<string> {
  const counter = new ArrayBuffer(8);
  const view = new DataView(counter);
  view.setUint32(0, Math.floor(step / 0x100000000));
  view.setUint32(4, step >>> 0);

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

/** Current 30-second window; also used to reject a replayed code. */
export function totpStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/**
 * Checks a 6-digit code against the shared secret, tolerating one window of
 * clock drift either way. Returns the matched step so the caller can refuse to
 * accept the same code twice.
 */
export async function verifyTotp(
  secret: string,
  code: string,
  nowMs: number = Date.now(),
): Promise<{ valid: boolean; step: number }> {
  const digits = code.replace(/\D/g, "");
  const secretBytes = base32Decode(secret);
  if (digits.length !== 6 || !secretBytes || secretBytes.length === 0) {
    return { valid: false, step: 0 };
  }
  const current = totpStep(nowMs);
  for (let offset = -TOTP_DRIFT_STEPS; offset <= TOTP_DRIFT_STEPS; offset += 1) {
    const step = current + offset;
    if (timingSafeEqual(await totpCode(secretBytes, step), digits)) {
      return { valid: true, step };
    }
  }
  return { valid: false, step: 0 };
}

/** `otpauth://` URI rendered as the QR code the authenticator app scans. */
export function otpauthUri(secret: string, username: string, issuer = "NovaStream"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(username || "owner")}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

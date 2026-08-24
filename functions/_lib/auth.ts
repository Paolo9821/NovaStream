const encoder = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<string> {
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

/** Issues an opaque `<expiry>.<hmac>` dashboard session token. */
export async function issueToken(secret: string): Promise<string> {
  const expiry = String(Date.now() + SESSION_MS);
  return `${expiry}.${await hmac(secret, expiry)}`;
}

export async function verifyToken(secret: string, token: string | null): Promise<boolean> {
  if (!token || !secret) return false;
  const [expiry, signature] = token.split(".");
  if (!expiry || !signature) return false;
  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = await hmac(secret, expiry);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
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

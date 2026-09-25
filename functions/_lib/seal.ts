/**
 * AES-256-GCM sealing for the playlist credentials a customer sends from the
 * website. They only sit on the server until the device collects them, and are
 * never stored in the clear even for that short window.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

/** Fresh 256-bit key, base64 encoded so it can live in the settings table. */
export function newSealKeyMaterial(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

export function importSealKey(material: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromBase64(material) as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Returns `base64(iv | ciphertext)`. */
export async function seal(key: CryptoKey, plain: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plain)),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return toBase64(out);
}

/** Null when the payload is damaged or was sealed with another key. */
export async function unseal(key: CryptoKey, sealed: string): Promise<string | null> {
  try {
    const bytes = fromBase64(sealed);
    if (bytes.length <= 12) return null;
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12),
    );
    return decoder.decode(plain);
  } catch {
    return null;
  }
}

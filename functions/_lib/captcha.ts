/**
 * Self-hosted image CAPTCHA with letters and numbers.
 *
 * The characters are drawn as distorted strokes (never as SVG text), so the
 * answer cannot be read out of the markup. The token is stateless: it carries
 * its own expiry and an HMAC of the answer; the Worker records the nonce once
 * it has been tried, so every challenge is good for a single attempt.
 */
const encoder = new TextEncoder();

/** No look-alikes: O/0, I/1, B/8, S/5, Z/2 and G/6 are left out on purpose. */
const ALPHABET = "ACDEFHJKLMNPQRTUVWXY23456789";

export const CAPTCHA_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000;

type Point = [number, number];
type Glyph = Point[][];

/** Stroke font on a 4 × 6 grid, y pointing down. */
const GLYPHS: Record<string, Glyph> = {
  A: [[[0, 6], [2, 0], [4, 6]], [[1, 3.6], [3, 3.6]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  J: [[[1, 0], [4, 0]], [[3, 0], [3, 5], [2, 6], [1, 6], [0, 5]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.6]], [[1.4, 2.5], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
  Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.4, 4.4], [4.2, 6.3]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 6]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 2.5], [3, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  "2": [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [0, 6], [4, 6]]],
  "3": [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1.5, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  "4": [[[3, 6], [3, 0], [0, 4], [4, 4]]],
  "5": [[[4, 0], [0, 0], [0, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  "6": [[[3.5, 0], [1, 0], [0, 1.5], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]]],
  "7": [[[0, 0], [4, 0], [1.5, 6]]],
  "8": [
    [[1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3]],
    [[1, 3], [0, 2], [0, 1], [1, 0]],
  ],
  "9": [[[4, 3], [1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [0.5, 6]]],
};

const INK = ["#7DD3FC", "#FDE68A", "#FCA5A5", "#A7F3D0", "#F0ABFC", "#FDBA74", "#E2E8F0"];
const NOISE = ["#334155", "#475569", "#1E3A5F", "#3F3F46"];

function randomInt(max: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

const random = (): number => randomInt(1_000_000) / 1_000_000;
const between = (min: number, max: number): number => min + random() * (max - min);
const pick = <T,>(list: readonly T[]): T => list[randomInt(list.length)];
const fixed = (value: number): string => value.toFixed(1);

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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Upper-cases and strips spaces, so "ab 3k" matches "AB3K". */
export function normalizeAnswer(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function drawSvg(answer: string): string {
  const width = 260;
  const height = 84;
  const parts: string[] = [];
  parts.push(`<rect width="${width}" height="${height}" rx="14" fill="#0B1220"/>`);

  // Background clutter drawn first, so the characters sit on top of it.
  for (let i = 0; i < 46; i += 1) {
    parts.push(
      `<circle cx="${fixed(between(0, width))}" cy="${fixed(between(0, height))}" r="${fixed(between(0.6, 2))}" fill="${pick(NOISE)}"/>`,
    );
  }
  for (let i = 0; i < 4; i += 1) {
    parts.push(
      `<path d="M${fixed(between(-10, 30))} ${fixed(between(0, height))} C${fixed(between(40, 110))} ${fixed(between(-20, height + 20))} ${fixed(between(140, 220))} ${fixed(between(-20, height + 20))} ${fixed(between(230, width + 10))} ${fixed(between(0, height))}" stroke="${pick(NOISE)}" stroke-width="${fixed(between(1.5, 3))}" fill="none" stroke-linecap="round"/>`,
    );
  }

  const cell = (width - 30) / answer.length;
  [...answer].forEach((char, index) => {
    const glyph = GLYPHS[char];
    if (!glyph) return;
    const unit = between(6.2, 7.6);
    const angle = (between(-24, 24) * Math.PI) / 180;
    const skew = between(-0.25, 0.25);
    const centerX = 15 + cell * index + cell / 2 + between(-3, 3);
    const centerY = height / 2 + between(-6, 6);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const color = pick(INK);
    const strokeWidth = fixed(between(2.6, 3.6));

    for (const stroke of glyph) {
      const points = stroke.map(([gx, gy]) => {
        // Centre the glyph, wobble every vertex a little, then skew and rotate.
        const x = (gx - 2 + between(-0.22, 0.22)) * unit;
        const y = (gy - 3 + between(-0.22, 0.22)) * unit;
        const sx = x + y * skew;
        return [centerX + sx * cos - y * sin, centerY + sx * sin + y * cos] as Point;
      });
      const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${fixed(x)} ${fixed(y)}`).join(" ");
      parts.push(
        `<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
  });

  // A couple of lines over the text, thin enough for a person to read through.
  for (let i = 0; i < 2; i += 1) {
    parts.push(
      `<path d="M0 ${fixed(between(18, height - 18))} Q${fixed(width / 2)} ${fixed(between(0, height))} ${width} ${fixed(between(18, height - 18))}" stroke="${pick(INK)}" stroke-opacity="0.45" stroke-width="1.4" fill="none"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${parts.join("")}</svg>`;
}

export type Challenge = { token: string; image: string; expiresAt: number };

/** A new challenge: the image for the visitor, the signed token for the check. */
export async function createChallenge(secret: string): Promise<Challenge> {
  let answer = "";
  for (let i = 0; i < CAPTCHA_LENGTH; i += 1) answer += ALPHABET[randomInt(ALPHABET.length)];
  const expiresAt = Date.now() + TTL_MS;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const payload = `${expiresAt}.${nonce}`;
  const signature = await hmac(secret, `${payload}.${answer}`);
  const svg = drawSvg(answer);
  return {
    token: `${payload}.${signature}`,
    image: `data:image/svg+xml;base64,${btoa(svg)}`,
    expiresAt,
  };
}

export type ChallengeCheck =
  | { ok: true; nonce: string; expiresAt: number }
  | { ok: false; nonce: string | null; expiresAt: number; reason: "expired" | "wrong" | "malformed" };

/** Verifies the answer. The caller must still burn the nonce either way. */
export async function checkChallenge(secret: string, token: string, answer: string): Promise<ChallengeCheck> {
  const [expiry, nonce, signature] = token.split(".");
  const expiresAt = Number(expiry);
  if (!expiry || !nonce || !signature || !Number.isFinite(expiresAt)) {
    return { ok: false, nonce: null, expiresAt: 0, reason: "malformed" };
  }
  if (expiresAt < Date.now()) return { ok: false, nonce, expiresAt, reason: "expired" };
  const expected = await hmac(secret, `${expiry}.${nonce}.${normalizeAnswer(answer)}`);
  if (!safeEqual(expected, signature)) return { ok: false, nonce, expiresAt, reason: "wrong" };
  return { ok: true, nonce, expiresAt };
}

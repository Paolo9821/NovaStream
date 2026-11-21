// Checks every Strings_<lang>.swift against strings_keys.json:
// same keys, no duplicates (duplicate dictionary keys crash at launch),
// same format specifiers in the same order.
import { readFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dir, "..");
const keys: string[] = JSON.parse(readFileSync(join(import.meta.dir, "strings_keys.json"), "utf8"));
const langs = ["it", "es", "fr", "de", "pt", "ro", "tr"];
const spec = (s: string) => (s.match(/%(@|d|ld|lld|\.\d+f|f)/g) ?? []).join(",");
const unescape = (s: string) => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
let failed = false;

for (const lang of langs) {
  const src = readFileSync(join(root, "NovaStreamIPTV/Localization", `Strings_${lang}.swift`), "utf8");
  const re = /^\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)",?\s*$/gm;
  const seen = new Map<string, string>();
  const problems: string[] = [];
  for (const m of src.matchAll(re)) {
    const k = unescape(m[1]), v = unescape(m[2]);
    if (seen.has(k)) problems.push(`duplicate: ${k}`);
    seen.set(k, v);
    if (spec(k) !== spec(v)) problems.push(`format mismatch: ${k} -> ${v}`);
  }
  for (const k of keys) if (!seen.has(k)) problems.push(`missing: ${k}`);
  for (const k of seen.keys()) if (!keys.includes(k)) problems.push(`extra: ${k}`);
  console.log(`${lang}: ${seen.size} keys, ${problems.length} problems`);
  problems.forEach((p) => console.log("  " + p));
  if (problems.length) failed = true;
}
process.exit(failed ? 1 : 0);

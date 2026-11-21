// Collects every t("...") key from the Swift sources into strings_keys.json.
// Run: bun ios-novastream/scripts/collect_strings.ts
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dir, "..", "NovaStreamIOS");
const keys = new Set<string>();

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith(".swift") && !name.startsWith("Strings_")) {
      const src = readFileSync(path, "utf8");
      for (const m of src.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) keys.add(m[1]);
    }
  }
}
walk(root);
const sorted = [...keys].sort();
writeFileSync(join(import.meta.dir, "strings_keys.json"), JSON.stringify(sorted, null, 2));
console.log(`${sorted.length} keys`);

// The Worker's bindings from wrangler.jsonc. Server code reads them with `import { env } from "cloudflare:workers"`.
declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
  }
}

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { pagePath } from "@/lib/seo";

// The Worker's entry: every request that is not a static file comes here. Durable Object classes named in
// wrangler.jsonc are exported from this file.
export default createServerEntry({
  fetch(request, opts) {
    const url = new URL(request.url);
    // One address per page: /about/, /about// and //about move permanently to /about. pagePath always starts the
    // location with exactly one slash, so a path such as //evil.com/ (or /\evil.com/, which the URL parser reads the
    // same way) never becomes a location another host answers (2026-11-18; the same guard as getNormalizedURL in
    // @tanstack/router-core 1.170.46, which this redirect runs before).
    const path = pagePath(url.pathname);
    if (path !== url.pathname) {
      return new Response(null, { status: 308, headers: { location: `${path}${url.search}` } });
    }
    return handler.fetch(request, opts);
  },
});

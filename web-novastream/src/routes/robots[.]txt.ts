import { createFileRoute } from "@tanstack/react-router";

import { siteOriginOf } from "@/server/site-origin";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(`User-agent: *\nAllow: /\n\nSitemap: ${siteOriginOf(request)}/sitemap.xml\n`, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
    },
  },
});

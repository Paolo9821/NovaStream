import { createFileRoute } from "@tanstack/react-router";

import { pagePath } from "@/lib/seo";
import { siteOriginOf } from "@/server/site-origin";

// Pages with a parameter in their path (/blog/$slug) are not listed by themselves: return their addresses here,
// from the same data the pages read, such as `posts.map((post) => `/blog/${encodeURIComponent(post.slug)}`)`.
async function pagesWithParameters(): Promise<string[]> {
  return [];
}

// Pages that are not for search results (a staff inbox, a thank-you page).
const UNLISTED = new Set<string>([]);

function hasServerHandlers(options: object): boolean {
  return (
    "server" in options && typeof options.server === "object" && options.server !== null && "handlers" in options.server
  );
}

async function pagePaths(): Promise<string[]> {
  const { getRouter } = await import("@/router");
  // Every route with a path is a page, except one that only answers requests in code: server handlers and no
  // component (an API route, this file). Server middleware alone still renders a page.
  const fixed = Object.values(getRouter().routesByPath)
    .filter((route) => !route.fullPath.includes("$"))
    .filter((route) => route.options.component !== undefined || !hasServerHandlers(route.options))
    .map((route) => route.fullPath);
  const paths = [...fixed, ...(await pagesWithParameters())].map(pagePath);
  return [...new Set(paths)].filter((path) => !UNLISTED.has(path));
}

function escapeXml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = siteOriginOf(request);
        const urls = (await pagePaths()).map((path) => `  <url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`);
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
          { headers: { "content-type": "application/xml; charset=utf-8" } },
        );
      },
    },
  },
});

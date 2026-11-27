import { isNotFound, rootRouteId } from "@tanstack/react-router";
import type { AnyRouteMatch } from "@tanstack/react-router";

// What a route's head() receives: every matched route, the root first and this page last.
type HeadContext = { matches: ReadonlyArray<AnyRouteMatch> };

type Seo = {
  title: string;
  description?: string;
  // A path under public/ ("/og-image.jpg") or a full URL. 1200×630 shows as a large card.
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
};

// A page rendered without a real visitor (a build-time prerender, a local dev server) has no public address.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

// The root loader's { siteOrigin } (src/routes/__root.tsx).
function siteOrigin(ctx: HeadContext): string | undefined {
  const data: unknown = ctx.matches[0]?.loaderData;
  if (typeof data !== "object" || data === null || !("siteOrigin" in data) || typeof data.siteOrigin !== "string") {
    return undefined;
  }
  return LOCAL_HOSTNAMES.has(new URL(data.siteOrigin).hostname) ? undefined : data.siteOrigin;
}

// A page's one spelling of its path: one leading slash, no empty segments, no trailing slash ("/" stays "/").
export function pagePath(pathname: string): string {
  return `/${pathname
    .split("/")
    .filter((segment) => segment !== "")
    .join("/")}`;
}

export function absoluteUrl(ctx: HeadContext, pathOrUrl: string): string {
  const origin = siteOrigin(ctx);
  return origin !== undefined && pathOrUrl.startsWith("/") ? `${origin}${pathOrUrl}` : pathOrUrl;
}

// This page's one address: the matched route's path without query or trailing slash. None unless every matched route
// loaded: a not-found page (an unmatched path, a loader's notFound(), or a path that matches only part of a route)
// and an error page get none.
export function canonicalUrl(ctx: HeadContext): string | undefined {
  const leaf = ctx.matches.at(-1);
  if (
    leaf === undefined ||
    leaf.routeId === rootRouteId ||
    !ctx.matches.every((match) => match.status === "success" && !isNotFound(match.error))
  ) {
    return undefined;
  }
  const url = absoluteUrl(ctx, pagePath(leaf.pathname));
  return url.startsWith("/") ? undefined : url;
}

// Title, description and the share tags (Open Graph, X) of one page, for its route's head(): `head: (ctx) => seo(ctx, { title, description })`.
export function seo(ctx: HeadContext, page: Seo): { meta: Array<Record<string, string>> } {
  const meta: Array<Record<string, string>> = [
    { title: page.title },
    { property: "og:title", content: page.title },
    { name: "twitter:title", content: page.title },
    { property: "og:type", content: page.type ?? "website" },
  ];
  if (page.description !== undefined) {
    meta.push(
      { name: "description", content: page.description },
      { property: "og:description", content: page.description },
      { name: "twitter:description", content: page.description },
    );
  }
  if (page.image !== undefined) {
    const image = absoluteUrl(ctx, page.image);
    meta.push(
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: image },
    );
    if (page.imageAlt !== undefined) {
      meta.push(
        { property: "og:image:alt", content: page.imageAlt },
        { name: "twitter:image:alt", content: page.imageAlt },
      );
    }
  }
  return { meta };
}

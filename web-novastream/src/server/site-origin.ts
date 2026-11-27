// The address search engines and link previews should name for this site. Rork hosting may send the site's
// primary address (its custom domain, else its rork.app address) in this header; without it, the address the
// request came to.
const SITE_ORIGIN_HEADER = "x-rork-site-origin";

export function siteOriginOf(request: Request): string {
  const header = request.headers.get(SITE_ORIGIN_HEADER);
  if (header !== null && URL.canParse(header)) {
    const url = new URL(header);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.origin;
    }
  }
  return new URL(request.url).origin;
}

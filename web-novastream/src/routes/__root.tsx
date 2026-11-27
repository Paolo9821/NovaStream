import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Link, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import { canonicalUrl, seo } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/site.functions";
import NotFound from "@/pages/NotFound";

import appCss from "../index.css?url";

const SITE_TITLE = "NovaStream – Media Player per Android TV e iPhone";
const SITE_DESCRIPTION =
  "Scarica NovaStream, il media player per Android TV, box, smartphone e iPhone. Guarda le tue playlist m3u e Xtream e attiva NovaStream in un minuto.";

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "NovaStream",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Android, Android TV, iOS, iPadOS",
  description:
    "NovaStream è un media player per Android TV, box, smartphone e iPhone: riproduce le playlist m3u e Xtream dell'utente. Nessun contenuto incluso.",
  url: "https://novastreamapp.com/",
  image: "https://novastreamapp.com/brand/novastream-512.png",
  downloadUrl: [
    "https://play.google.com/store/apps/details?id=com.rork.novastream",
    "https://apps.apple.com/app/id6838075128",
  ],
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Runs once on the server; later navigations reuse it.
  loader: async () => ({ siteOrigin: await getSiteOrigin() }),
  staleTime: Infinity,
  // The site's defaults. A page's own head() replaces the tags it sets (seo() in src/lib/seo.ts). The canonical
  // address and og:url are written here for every page and never by a page.
  head: (ctx) => {
    const url = canonicalUrl(ctx);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1.0" },
        ...seo(ctx, { title: SITE_TITLE, description: SITE_DESCRIPTION }).meta,
        { name: "application-name", content: "NovaStream" },
        { name: "apple-mobile-web-app-title", content: "NovaStream" },
        { name: "theme-color", content: "#060910" },
        { name: "robots", content: "index, follow" },
        { property: "og:site_name", content: "NovaStream" },
        { property: "og:locale", content: "it_IT" },
        { name: "twitter:card", content: "summary" },
        ...(url === undefined ? [] : [{ property: "og:url", content: url }]),
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap",
        },
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/brand/novastream-32.png" },
        { rel: "icon", type: "image/png", sizes: "48x48", href: "/brand/novastream-48.png" },
        { rel: "icon", type: "image/png", sizes: "96x96", href: "/brand/novastream-96.png" },
        { rel: "icon", type: "image/png", sizes: "192x192", href: "/brand/novastream-192.png" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/brand/novastream-apple-180.png" },
        ...(url === undefined ? [] : [{ rel: "canonical", href: url }]),
      ],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(STRUCTURED_DATA) }],
    };
  },
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <TooltipProvider>
        <Toaster theme="dark" position="top-center" />
        {children}
      </TooltipProvider>
    </LanguageProvider>
  );
}

function RootComponent() {
  return (
    <RootDocument>
      <Providers>
        <Outlet />
      </Providers>
    </RootDocument>
  );
}

function RootError() {
  const router = useRouter();
  return (
    <RootDocument head={<ErrorHead />}>
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="px-6 text-center">
          <h1 className="mb-4 text-4xl font-bold">Qualcosa è andato storto</h1>
          <p className="mb-4 text-xl text-muted-foreground">Non è stato possibile mostrare la pagina. Riprova.</p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => void router.invalidate()}
              className="text-primary underline hover:text-primary/90"
            >
              Riprova
            </button>
            <Link to="/" className="text-primary underline hover:text-primary/90">
              Torna alla home
            </Link>
          </div>
        </div>
      </div>
    </RootDocument>
  );
}

// The error page's own head: the page's tags would still name its address after a render error in the browser.
function ErrorHead() {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="robots" content="noindex" />
      <title>NovaStream</title>
      <link rel="stylesheet" href={appCss} />
      <link rel="icon" href="/favicon.ico" sizes="any" />
    </>
  );
}

function RootDocument({ children, head = <HeadContent /> }: { children: ReactNode; head?: ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>{head}</head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

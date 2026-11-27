import { createFileRoute } from "@tanstack/react-router";

import { seo } from "@/lib/seo";
import Reseller from "@/pages/Reseller";

export const Route = createFileRoute("/rivenditore")({
  component: Reseller,
  ssr: false,
  head: (ctx) => seo(ctx, { title: "NovaStream · Pannello rivenditore" }),
});

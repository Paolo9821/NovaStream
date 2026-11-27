import { createFileRoute } from "@tanstack/react-router";

import { seo } from "@/lib/seo";
import Reseller from "@/pages/Reseller";

export const Route = createFileRoute("/reseller")({
  component: Reseller,
  ssr: false,
  head: (ctx) => seo(ctx, { title: "NovaStream · Pannello rivenditore" }),
});

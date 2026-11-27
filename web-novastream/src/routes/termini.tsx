import { createFileRoute } from "@tanstack/react-router";

import { TermsPage } from "@/pages/Legal";

export const Route = createFileRoute("/termini")({ component: TermsPage });

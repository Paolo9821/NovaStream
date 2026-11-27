import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPage } from "@/pages/Legal";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

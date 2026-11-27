import { createFileRoute } from "@tanstack/react-router";

import Transfer from "@/pages/Transfer";

export const Route = createFileRoute("/transfer")({ component: Transfer });

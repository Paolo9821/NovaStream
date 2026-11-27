import { createFileRoute } from "@tanstack/react-router";

import Device from "@/pages/Device";

export const Route = createFileRoute("/device")({ component: Device });

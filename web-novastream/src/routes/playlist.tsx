import { createFileRoute } from "@tanstack/react-router";

import Playlists from "@/pages/Playlists";

export const Route = createFileRoute("/playlist")({ component: Playlists });

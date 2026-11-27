import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { siteOriginOf } from "@/server/site-origin";

// A server function: its handler runs only on the server. Route loaders and components call it like a normal
// function; from the browser the call is an HTTP request.
export const getSiteOrigin = createServerFn({ method: "GET" }).handler(async () => {
  return siteOriginOf(getRequest());
});

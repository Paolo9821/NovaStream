import { useEffect, useState } from "react";

import { useQueryParams } from "@/hooks/use-query-params";

const KEY = "ns-from-app";

/**
 * True when the page was opened from the Android app (`?app=1`). Pages reached
 * that way must not link to the shop: Google Play forbids apps from leading users
 * to a payment method outside Play billing. Kept for the whole browser session.
 * `?app=1` counts from the first render (also on the server); the session flag is
 * read after it, since the server cannot see the browser session.
 */
export function useFromApp(): boolean {
  const query = useQueryParams();
  const [fromApp, setFromApp] = useState<boolean>(() => query.get("app") === "1");
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("app") === "1") sessionStorage.setItem(KEY, "1");
      setFromApp(sessionStorage.getItem(KEY) === "1");
    } catch {
      setFromApp(false);
    }
  }, []);
  return fromApp;
}

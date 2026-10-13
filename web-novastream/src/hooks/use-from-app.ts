import { useMemo } from "react";

const KEY = "ns-from-app";

/**
 * True when the page was opened from the Android app (`?app=1`). Pages reached
 * that way must not link to the shop: Google Play forbids apps from leading users
 * to a payment method outside Play billing. Kept for the whole browser session.
 */
export function useFromApp(): boolean {
  return useMemo<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("app") === "1") sessionStorage.setItem(KEY, "1");
      return sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  }, []);
}

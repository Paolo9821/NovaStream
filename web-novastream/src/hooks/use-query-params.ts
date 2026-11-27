import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";

/**
 * The address bar's query string (?device=…&code=…) as URLSearchParams. Read from the router, so it is the same on
 * the server and in the browser and pages can use it while rendering.
 */
export function useQueryParams(): URLSearchParams {
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  return useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

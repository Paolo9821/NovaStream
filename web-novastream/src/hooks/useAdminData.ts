import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  post,
  type LicenseRecord,
  type OrderRecord,
  type PromoCode,
  type PromoRedemption,
  type RegistryStats,
  type SupportTicket,
  type TrialRecord,
} from "@/lib/api";

export type LicensesPayload = {
  licenses: LicenseRecord[];
  stats: RegistryStats;
  trials: TrialRecord[];
  orders: OrderRecord[];
};

export type TicketsPayload = { tickets: SupportTicket[]; openCount: number };

export type PromoPayload = { codes: PromoCode[]; redemptions: PromoRedemption[] };

/** Licences, trials, orders and stats: one call shared by every section. */
export function useLicenses(token: string) {
  return useQuery({
    queryKey: ["licenses"],
    queryFn: () => post<LicensesPayload>("/api/admin/licenses", {}, token),
    refetchInterval: 60_000,
  });
}

export function useTickets(token: string) {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: () => post<TicketsPayload>("/api/admin/tickets", {}, token),
    refetchInterval: 60_000,
  });
}

export function usePromos(token: string) {
  return useQuery({
    queryKey: ["promos"],
    queryFn: () => post<PromoPayload>("/api/admin/promo-list", {}, token),
    refetchInterval: 120_000,
  });
}

/**
 * Generic dashboard action: posts, refreshes the given data and toasts the outcome.
 * `success` can be a fixed message or built from the response.
 */
export function useAdminAction<T = { ok: boolean }>(
  token: string,
  keys: string[],
  success: string | ((data: T) => string) = "Fatto",
) {
  const queryClient = useQueryClient();
  const refresh = useCallback((): void => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  }, [keys, queryClient]);

  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) => post<T>(path, body, token),
    onSuccess: (data) => {
      refresh();
      const message = typeof success === "function" ? success(data) : success;
      if (message) toast.success(message);
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Operazione non riuscita"),
  });
}

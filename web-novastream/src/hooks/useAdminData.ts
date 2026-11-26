import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  post,
  type AuditEntry,
  type LicenseRecord,
  type OrderRecord,
  type PromoCode,
  type PromoRedemption,
  type RegistryStats,
  type ResellerInfo,
  type SupportTicket,
  type TransferRecord,
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

/** Licences customers moved themselves from the transfer page. */
export function useTransfers(token: string) {
  return useQuery({
    queryKey: ["transfers"],
    queryFn: () => post<{ transfers: TransferRecord[] }>("/api/admin/transfers", {}, token),
    refetchInterval: 120_000,
  });
}

export function usePromos(token: string) {
  return useQuery({
    queryKey: ["promos"],
    queryFn: () => post<PromoPayload>("/api/admin/promo-list", {}, token),
    refetchInterval: 120_000,
  });
}

/** Reseller accounts with what each one sold, redeemed and revoked. */
export function useResellers(token: string) {
  return useQuery({
    queryKey: ["resellers"],
    queryFn: () => post<{ resellers: ResellerInfo[] }>("/api/admin/resellers", {}, token),
    refetchInterval: 120_000,
  });
}

/** Activity log of the owner or of the resellers (optionally one of them). */
export function useLogs(token: string, actorType: "admin" | "reseller", actorId = "", enabled = true) {
  return useQuery({
    queryKey: ["logs", actorType, actorId],
    queryFn: () => post<{ entries: AuditEntry[] }>("/api/admin/logs", { actorType, actorId, limit: 500 }, token),
    refetchInterval: 60_000,
    enabled,
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
    onError: (error: unknown) => toast.error(error instanceof Error ? errorText(error.message) : "Operazione non riuscita"),
  });
}

const ERROR_TEXT: Record<string, string> = {
  "invalid email": "Email non valida.",
  "password too short": "La password deve avere almeno 8 caratteri.",
  "nothing to change": "Non hai cambiato niente.",
  "username taken": "Nome utente già in uso.",
  "invalid username": "Nome utente non valido: 3-32 caratteri, lettere minuscole, numeri, punto, trattino.",
  "not enough credits": "Crediti insufficienti.",
  "code used up": "Il codice è già esaurito: aumenta i suoi utilizzi prima di ripristinare.",
  "uses below used": "Non puoi scendere sotto gli utilizzi già fatti.",
  "reseller not found": "Rivenditore non trovato.",
  "use not found": "Utilizzo non trovato.",
  "code not found": "Codice non trovato.",
  "invalid device id": "ID o MAC non valido.",
  "already lifetime": "Il dispositivo ha già una licenza a vita.",
  "device has licence": "Il dispositivo ha già una licenza di un altro venditore.",
  "device blocked": "Il dispositivo è bloccato.",
  "blocked by owner": "Bloccata dal titolare: non puoi riattivarla.",
  "invalid years": "Scegli da 1 a 5 anni.",
  "license not found": "Licenza non trovata.",
};

/** Italian text for the server's error codes; unknown ones pass through. */
export function errorText(message: string): string {
  return ERROR_TEXT[message] ?? message;
}

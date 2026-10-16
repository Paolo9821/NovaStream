import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Inbox, Loader2, Mail, PlayCircle, Smartphone, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTickets } from "@/hooks/useAdminData";
import { EmptyState, RowButton } from "@/components/dashboard/ui";
import { formatDate, formatDateTime, formatMac, post, type SupportTicket, type TicketStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Labels for the topic chosen in the contact form on the store. */
const TOPIC_LABELS: Record<string, string> = {
  subscription: "Abbonamento non funziona",
  payment: "Problema di pagamento",
  activation: "Attivazione o cambio dispositivo",
  other: "Altro",
};

export type TicketFolder = "new" | "open" | "closed";

const EMPTY_TEXT: Record<TicketFolder, string> = {
  new: "Nessuna nuova richiesta. Quando un cliente scrive dal sito, comparirà qui.",
  open: "Nessuna richiesta in lavorazione.",
  closed: "Nessuna richiesta chiusa.",
};

/**
 * Requests sent from the contact form on the store, one folder at a time.
 * They arrive here directly, so nothing depends on an email inbox being watched.
 */
export function SupportInbox({ token, folder }: { token: string; folder: TicketFolder }) {
  const queryClient = useQueryClient();
  const inbox = useTickets(token);

  const refresh = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: ["tickets"] });
  }, [queryClient]);

  const update = useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      post<{ ok: boolean }>(path, body, token),
    onSuccess: () => refresh(),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Operazione non riuscita"),
  });

  const visible = useMemo(
    () => (inbox.data?.tickets ?? []).filter((ticket) => ticket.status === folder),
    [inbox.data, folder],
  );

  return (
    <div className="space-y-2.5">
      {inbox.isLoading && (
        <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico le richieste…
        </div>
      )}
      {!inbox.isLoading && visible.length === 0 && <EmptyState icon={Inbox}>{EMPTY_TEXT[folder]}</EmptyState>}
      {visible.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          busy={update.isPending}
          onStatus={(status) =>
            update.mutate({ path: "/api/admin/ticket-status", body: { id: ticket.id, status } })
          }
          onRemove={() => {
            if (window.confirm("Eliminare definitivamente questa richiesta?")) {
              update.mutate({ path: "/api/admin/ticket-remove", body: { id: ticket.id } });
            }
          }}
        />
      ))}
    </div>
  );
}

function TicketCard({
  ticket,
  busy,
  onStatus,
  onRemove,
}: {
  ticket: SupportTicket;
  busy: boolean;
  onStatus: (status: TicketStatus) => void;
  onRemove: () => void;
}) {
  const tone: Record<TicketStatus, string> = {
    new: "border-primary/50 bg-primary/15 text-primary",
    open: "border-warning/40 bg-warning/10 text-warning",
    closed: "border-border/70 bg-secondary/60 text-muted-foreground",
  };
  const label: Record<TicketStatus, string> = {
    new: "Nuova",
    open: "In corso",
    closed: "Chiusa",
  };
  const licence = ticket.license;
  const licenceLabel = licence
    ? licence.status !== "active"
      ? licence.status === "suspended"
        ? "licenza sospesa"
        : "licenza revocata"
      : licence.expired
        ? `scaduta il ${formatDate(licence.expiresAt)}`
        : licence.expiresAt
          ? `attiva fino al ${formatDate(licence.expiresAt)}`
          : "attiva a vita"
    : "nessuna licenza trovata";

  return (
    <div
      className={cn(
        "panel p-4 transition hover:border-border",
        ticket.status === "new" && "border-primary/35",
        ticket.status === "closed" && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                tone[ticket.status],
              )}
            >
              {label[ticket.status]}
            </span>
            <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {TOPIC_LABELS[ticket.topic] ?? ticket.topic}
            </span>
            {ticket.lang && (
              <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                {ticket.lang}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {formatDateTime(ticket.createdAt)}
            </span>
          </div>

          <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {ticket.message}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(ticket.email);
                toast.success("Email copiata");
              }}
              className="group flex items-center gap-1.5 transition hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" />
              {ticket.email}
              <Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
            </button>
            {ticket.deviceId && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(ticket.deviceId);
                  toast.success("ID copiato");
                }}
                className="mono group flex items-center gap-1.5 transition hover:text-foreground"
              >
                <Smartphone className="h-3.5 w-3.5" />
                {formatMac(ticket.deviceId)}
                <Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
              </button>
            )}
            {ticket.deviceId && (
              <span
                className={cn(
                  licence && licence.status === "active" && !licence.expired
                    ? "text-accent"
                    : "text-warning",
                )}
              >
                {licenceLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <a
              href={`mailto:${ticket.email}?subject=${encodeURIComponent("NovaStream · assistenza")}`}
            >
              <Mail className="h-3.5 w-3.5" />
              Rispondi
            </a>
          </Button>
          {ticket.status === "new" && (
            <RowButton
              icon={PlayCircle}
              label="Presa in carico"
              disabled={busy}
              onClick={() => onStatus("open")}
            />
          )}
          {ticket.status !== "closed" && (
            <RowButton
              icon={CheckCircle2}
              label="Chiudi"
              disabled={busy}
              onClick={() => onStatus("closed")}
            />
          )}
          {ticket.status === "closed" && (
            <RowButton icon={Undo2} label="Riapri" disabled={busy} onClick={() => onStatus("open")} />
          )}
          <RowButton icon={Trash2} label="Elimina" danger disabled={busy} onClick={onRemove} />
        </div>
      </div>
    </div>
  );
}

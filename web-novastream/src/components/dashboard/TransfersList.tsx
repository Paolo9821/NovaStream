import { ArrowRight, ArrowRightLeft, KeyRound, Loader2, Mail } from "lucide-react";

import { useTransfers } from "@/hooks/useAdminData";
import { EmptyState } from "@/components/dashboard/ui";
import { formatDateTime, formatMac } from "@/lib/api";

/**
 * Every licence a customer moved from the transfer page, newest first.
 * The site sends no email, so this list is where a move is noticed.
 */
export function TransfersList({ token }: { token: string }) {
  const query = useTransfers(token);
  const transfers = query.data?.transfers ?? [];

  if (query.isLoading) {
    return (
      <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carico i trasferimenti…
      </div>
    );
  }
  if (transfers.length === 0) {
    return (
      <EmptyState icon={ArrowRightLeft}>
        Nessun trasferimento. Quando un cliente sposta la licenza dalla pagina /transfer, comparirà qui.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2.5">
      {transfers.map((transfer) => (
        <div key={transfer.id} className="panel flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
          <div className="flex items-center gap-2 font-mono text-[13px]">
            <span className="text-muted-foreground">{formatMac(transfer.fromId)}</span>
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
            <span>{formatMac(transfer.toId)}</span>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{transfer.plan || "-"}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {transfer.method === "email" ? <Mail className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
            {transfer.method === "email" ? "Email di acquisto" : "Chiave del vecchio dispositivo"}
          </span>
          {transfer.email && (
            <a href={`mailto:${transfer.email}`} className="text-xs text-primary hover:underline">
              {transfer.email}
            </a>
          )}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatDateTime(transfer.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

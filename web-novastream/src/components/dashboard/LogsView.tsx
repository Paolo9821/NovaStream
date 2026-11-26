import { useMemo, useState } from "react";
import { Loader2, ScrollText, Search, ShieldCheck, Store } from "lucide-react";

import { Input } from "@/components/ui/input";
import { EmptyState, Pill, SubTabs } from "@/components/dashboard/ui";
import { useLogs } from "@/hooks/useAdminData";
import { formatDateTime, type AuditEntry, type ResellerInfo } from "@/lib/api";
import { actionLabel } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export type LogFolder = "admin" | "reseller";

/** Detail keys worth showing, with their Italian names. */
const DETAIL_LABELS: Record<string, string> = {
  status: "stato",
  email: "email",
  previous: "prima",
  delta: "crediti",
  credits: "saldo",
  cost: "costo",
  years: "anni",
  count: "quanti",
  codes: "codici",
  maxUses: "utilizzi max",
  note: "nota",
  reason: "motivo",
  days: "giorni",
  term: "durata",
  plan: "formula",
  assigned: "assegnate",
  notFound: "non trovate",
  disabled: "sospeso",
  error: "errore",
  mac: "MAC",
  passwordChanged: "password cambiata",
};

function detailText(details: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, label] of Object.entries(DETAIL_LABELS)) {
    const value = details[key];
    if (value === undefined || value === null || value === "") continue;
    let text: string;
    if (Array.isArray(value)) text = value.length > 4 ? `${value.slice(0, 4).join(", ")} +${value.length - 4}` : value.join(", ");
    else if (typeof value === "object") text = JSON.stringify(value);
    else if (typeof value === "boolean") text = value ? "sì" : "no";
    else text = String(value);
    if (text) parts.push(`${label}: ${text}`);
  }
  return parts.join(" · ");
}

export function LogsView({
  token,
  folder,
  onFolder,
  resellers,
}: {
  token: string;
  folder: LogFolder;
  onFolder: (folder: LogFolder) => void;
  resellers: ResellerInfo[];
}) {
  const [resellerId, setResellerId] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const logs = useLogs(token, folder, folder === "reseller" ? resellerId : "");

  const entries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = logs.data?.entries ?? [];
    if (!needle) return all;
    return all.filter((entry) =>
      [entry.actorName, entry.action, actionLabel(entry.action).label, entry.target, entry.ip, JSON.stringify(entry.details)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [logs.data, search]);

  return (
    <div className="space-y-5">
      <SubTabs
        items={[
          { id: "admin" as const, label: "Admin", icon: ShieldCheck },
          { id: "reseller" as const, label: "Rivenditori", icon: Store },
        ]}
        value={folder}
        onChange={onFolder}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca azione, MAC, codice, email o IP"
            className="h-11 border-border/80 bg-secondary/60 pl-9"
          />
        </div>
        {folder === "reseller" && (
          <select
            value={resellerId}
            onChange={(event) => setResellerId(event.target.value)}
            className="h-11 rounded-md border border-border/80 bg-secondary/60 px-3 text-sm"
          >
            <option value="">Tutti i rivenditori</option>
            {resellers.map((reseller) => (
              <option key={reseller.id} value={reseller.id}>
                {reseller.username}
              </option>
            ))}
          </select>
        )}
      </div>

      {logs.isLoading ? (
        <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico il registro…
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={ScrollText}>
          {search ? "Nessuna voce corrisponde alla ricerca." : "Nessuna attività registrata finora."}
        </EmptyState>
      ) : (
        <div className="panel divide-y divide-border/50 overflow-hidden">
          {entries.map((entry) => (
            <LogRow key={entry.id} entry={entry} showActor={folder === "reseller"} />
          ))}
        </div>
      )}
      {entries.length > 0 && (
        <p className="text-xs text-muted-foreground">Ultime {entries.length} voci, dalla più recente.</p>
      )}
    </div>
  );
}

function LogRow({ entry, showActor }: { entry: AuditEntry; showActor: boolean }) {
  const { label, refused } = actionLabel(entry.action);
  const failed = refused || entry.action === "login_failed";
  const details = detailText(entry.details ?? {});
  return (
    <div className={cn("flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 text-sm", failed && "bg-destructive/5")}>
      <span className="w-36 shrink-0 pt-0.5 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showActor && (
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <Store className="h-3.5 w-3.5" />
              {entry.actorName || "—"}
            </span>
          )}
          <span className="font-medium">{label}</span>
          {failed && (
            <Pill tone="destructive" strong>
              {refused ? "Rifiutato" : "Fallito"}
            </Pill>
          )}
          {entry.target && <span className="mono text-xs text-muted-foreground">{entry.target}</span>}
        </div>
        {details && <div className="mt-0.5 break-words text-xs text-muted-foreground">{details}</div>}
      </div>
      {entry.ip && <span className="mono shrink-0 text-[11px] text-muted-foreground">{entry.ip}</span>}
    </div>
  );
}

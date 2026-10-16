import { useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  Crown,
  Hourglass,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { EditTermDialog, GrantDialog } from "@/components/dashboard/LicenseDialogs";
import { CopyChip, EmptyState, Pill, SubTabs, type PillTone } from "@/components/dashboard/ui";
import { useAdminAction, type LicensesPayload } from "@/hooks/useAdminData";
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatMac,
  normalizeDeviceId,
  type LicenseRecord,
  type TrialRecord,
} from "@/lib/api";
import { licenseState, sourceLabel, termCodeLabel, type LicenseState } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export type CustomerFolder = "trial" | "subscription" | "lifetime" | "expired" | "blocked";

const STATE_PILL: Record<LicenseState, { tone: PillTone; label: string }> = {
  active: { tone: "accent", label: "Attiva" },
  expired: { tone: "warning", label: "Scaduta" },
  suspended: { tone: "warning", label: "Sospesa" },
  revoked: { tone: "destructive", label: "Revocata" },
};

/** Splits licences and trials into the folders shown in the console. */
export function useCustomerFolders(data: LicensesPayload | undefined, search: string) {
  return useMemo(() => {
    const needle = normalizeDeviceId(search);
    const plain = search.trim().toLowerCase();
    const licenses = (data?.licenses ?? []).filter(
      (row) =>
        !plain ||
        row.deviceId.includes(needle) ||
        (row.aliases ?? []).some((alias) => alias.includes(needle)) ||
        row.email.toLowerCase().includes(plain) ||
        row.label.toLowerCase().includes(plain),
    );
    const trials = (data?.trials ?? []).filter(
      (trial) =>
        !trial.converted &&
        (!plain || trial.deviceId.includes(needle) || trial.aliases.some((alias) => alias.includes(needle))),
    );
    const live = licenses.filter((row) => row.status === "active" && !row.expired);
    return {
      trial: trials,
      subscription: live.filter((row) => row.expiresAt !== null).sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0)),
      lifetime: live.filter((row) => row.expiresAt === null),
      expired: licenses.filter((row) => row.status === "active" && row.expired),
      blocked: licenses.filter((row) => row.status === "suspended" || row.status === "revoked"),
    };
  }, [data, search]);
}

const FOLDER_HINT: Record<CustomerFolder, string> = {
  trial: "Dispositivi nella settimana gratuita. Chi compra una licenza esce da qui.",
  subscription: "Licenze a tempo in corso, dalla più vicina alla scadenza.",
  lifetime: "Licenze senza scadenza.",
  expired: "Hanno avuto una licenza: sono i rinnovi da recuperare.",
  blocked: "Sospesi o revocati a mano da qui.",
};

export function CustomersView({
  token,
  data,
  loading,
  folder,
  onFolder,
}: {
  token: string;
  data: LicensesPayload | undefined;
  loading: boolean;
  folder: CustomerFolder;
  onFolder: (folder: CustomerFolder) => void;
}) {
  const [search, setSearch] = useState<string>("");
  const [grantFor, setGrantFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<LicenseRecord | null>(null);
  const folders = useCustomerFolders(data, search);
  const action = useAdminAction(token, ["licenses"]);

  const tabs = [
    { id: "trial" as const, label: "In prova", count: folders.trial.filter((t) => !t.expired).length, icon: Hourglass },
    { id: "subscription" as const, label: "Abbonamenti", count: folders.subscription.length, icon: CalendarClock },
    { id: "lifetime" as const, label: "A vita", count: folders.lifetime.length, icon: Crown },
    { id: "expired" as const, label: "Scaduti", count: folders.expired.length, icon: RotateCcw },
    { id: "blocked" as const, label: "Bloccati", count: folders.blocked.length, icon: Ban },
  ];

  const run = (path: string, body: Record<string, unknown>): void => action.mutate({ path, body });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca MAC, email o nome in tutte le cartelle"
            className="h-11 border-border/80 bg-secondary/60 pl-9"
          />
        </div>
        <Button onClick={() => setGrantFor("")} className="h-11 gap-2">
          <Plus className="h-4 w-4" /> Attiva dispositivo
        </Button>
      </div>

      <SubTabs items={tabs} value={folder} onChange={onFolder} />
      <p className="-mt-2 text-xs text-muted-foreground">{FOLDER_HINT[folder]}</p>

      {loading ? (
        <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico i clienti…
        </div>
      ) : folder === "trial" ? (
        <TrialList trials={folders.trial} onActivate={(id) => setGrantFor(id)} />
      ) : (
        <LicenseTable
          rows={folders[folder]}
          busy={action.isPending}
          onEditTerm={setEditing}
          onAction={run}
          empty={search ? "Nessun risultato in questa cartella." : "Nessun cliente in questa cartella."}
        />
      )}

      <GrantDialog
        token={token}
        open={grantFor !== null}
        onOpenChange={(open) => !open && setGrantFor(null)}
        initialDeviceId={grantFor ?? ""}
      />
      <EditTermDialog token={token} row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

const LICENSE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,1.6fr)_6.5rem_7rem_7.5rem_9rem_auto]";

function LicenseTable({
  rows,
  busy,
  onEditTerm,
  onAction,
  empty,
}: {
  rows: LicenseRecord[];
  busy: boolean;
  onEditTerm: (row: LicenseRecord) => void;
  onAction: (path: string, body: Record<string, unknown>) => void;
  empty: string;
}) {
  if (rows.length === 0) return <EmptyState icon={Users}>{empty}</EmptyState>;
  return (
    <div className="panel overflow-hidden">
      <div
        className={cn(
          LICENSE_GRID,
          "hidden border-b border-border/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid",
        )}
      >
        <span>Cliente</span>
        <span>Stato</span>
        <span>Durata</span>
        <span>Scadenza</span>
        <span>Ultimo accesso</span>
        <span className="w-[7.5rem]" />
      </div>
      <div className="divide-y divide-border/50">
        {rows.map((row) => (
          <LicenseRow key={row.deviceId} row={row} busy={busy} onEditTerm={onEditTerm} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

function LicenseRow({
  row,
  busy,
  onEditTerm,
  onAction,
}: {
  row: LicenseRecord;
  busy: boolean;
  onEditTerm: (row: LicenseRecord) => void;
  onAction: (path: string, body: Record<string, unknown>) => void;
}) {
  const state = licenseState(row);
  const pill = STATE_PILL[state];
  const left = row.expiresAt ? daysUntil(row.expiresAt) : null;

  return (
    <div className={cn(LICENSE_GRID, "px-4 py-3.5 transition hover:bg-secondary/25")}>
      <div className="min-w-0">
        <CopyChip
          value={row.deviceId}
          display={formatMac(row.deviceId)}
          toastLabel="ID copiato"
          className="text-sm font-semibold tracking-wide"
        />
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          {row.label && <span className="text-foreground/80">{row.label}</span>}
          {row.email && <span className="truncate">{row.email}</span>}
          <span className="text-muted-foreground/70">{sourceLabel(row.source)}</span>
          {(row.aliases ?? []).length > 0 && (
            <span className="mono">anche {(row.aliases ?? []).map(formatMac).join(" · ")}</span>
          )}
        </div>
        {/* Compact facts for small screens; the wide layout uses columns instead. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 lg:hidden">
          <Pill tone={pill.tone} strong>
            {pill.label}
          </Pill>
          <Pill tone="muted">{termCodeLabel(row.term)}</Pill>
          <span className="text-xs text-muted-foreground">
            {row.expiresAt ? `scade il ${formatDate(row.expiresAt)}` : "nessuna scadenza"}
          </span>
        </div>
      </div>
      <div className="hidden lg:block">
        <Pill tone={pill.tone} strong>
          {pill.label}
        </Pill>
      </div>
      <div className="hidden text-sm lg:block">{termCodeLabel(row.term)}</div>
      <div className="hidden text-sm lg:block">
        {row.expiresAt ? (
          <>
            <div>{formatDate(row.expiresAt)}</div>
            {state === "active" && left !== null && (
              <div className={cn("text-[11px]", left <= 7 ? "text-warning" : "text-muted-foreground")}>
                {left === 0 ? "scade oggi" : `tra ${left} giorni`}
              </div>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className="hidden text-xs text-muted-foreground lg:block">{formatDateTime(row.lastSeenAt)}</div>
      <div className="flex items-center justify-end gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onEditTerm(row)}
          className="h-8 gap-1.5 text-xs"
        >
          <CalendarClock className="h-3.5 w-3.5" /> Scadenza
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy} className="h-8 w-8 p-0" aria-label="Altre azioni">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {row.status !== "active" ? (
              <DropdownMenuItem
                onClick={() => onAction("/api/admin/set-status", { deviceId: row.deviceId, status: "active" })}
              >
                <PlayCircle className="mr-2 h-4 w-4" /> Riattiva
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onAction("/api/admin/set-status", { deviceId: row.deviceId, status: "suspended" })}
              >
                <PauseCircle className="mr-2 h-4 w-4" /> Sospendi
              </DropdownMenuItem>
            )}
            {row.status !== "revoked" && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onAction("/api/admin/set-status", { deviceId: row.deviceId, status: "revoked" })}
              >
                <Ban className="mr-2 h-4 w-4" /> Revoca
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (window.confirm("Eliminare definitivamente questa licenza?")) {
                  onAction("/api/admin/remove", { deviceId: row.deviceId });
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Elimina
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function TrialList({ trials, onActivate }: { trials: TrialRecord[]; onActivate: (deviceId: string) => void }) {
  const [showExpired, setShowExpired] = useState<boolean>(false);
  const running = trials.filter((trial) => !trial.expired);
  const expired = trials.filter((trial) => trial.expired);
  const visible = showExpired ? expired : running;
  const reinstalls = trials.reduce((sum, trial) => sum + Math.max(0, trial.installs - 1), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            [false, `In corso (${running.length})`],
            [true, `Prova finita (${expired.length})`],
          ] as [boolean, string][]
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setShowExpired(value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              showExpired === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {reinstalls} {reinstalls === 1 ? "reinstallazione" : "reinstallazioni"} in totale
        </span>
      </div>
      {visible.length === 0 ? (
        <EmptyState icon={Hourglass}>
          {showExpired ? "Nessuna prova finita senza acquisto." : "Nessuna prova in corso. I nuovi dispositivi compaiono qui al primo avvio."}
        </EmptyState>
      ) : (
        <div className="panel divide-y divide-border/50 overflow-hidden">
          {visible.map((trial) => (
            <TrialRow key={trial.deviceId} trial={trial} onActivate={() => onActivate(trial.deviceId)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrialRow({ trial, onActivate }: { trial: TrialRecord; onActivate: () => void }) {
  const left = daysUntil(trial.expiresAt);
  const reinstalls = Math.max(0, trial.installs - 1);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-secondary/25">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CopyChip
            value={trial.deviceId}
            display={formatMac(trial.deviceId)}
            toastLabel="ID copiato"
            className="text-sm font-semibold tracking-wide"
          />
          <Pill tone={trial.expired ? "muted" : "primary"} strong>
            {trial.expired ? "Prova finita" : left === 0 ? "Ultimo giorno" : `${left} giorni`}
          </Pill>
          {reinstalls > 0 && (
            <Pill tone="warning">
              <RotateCcw className="h-3 w-3" /> reinstallato {reinstalls}×
            </Pill>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {trial.aliases.length > 0 && <span className="mono">anche {trial.aliases.map(formatMac).join(" · ")}</span>}
          <span>Inizio: {formatDate(trial.startedAt)}</span>
          <span>Fine: {formatDate(trial.expiresAt)}</span>
          <span>Ultimo accesso: {formatDateTime(trial.lastSeenAt)}</span>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onActivate} className="h-8 gap-1.5 text-xs">
        <Zap className="h-3.5 w-3.5" /> Attiva
      </Button>
    </div>
  );
}

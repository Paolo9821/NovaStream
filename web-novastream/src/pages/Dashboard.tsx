import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarPlus,
  CircleDollarSign,
  Copy,
  Loader2,
  LockKeyhole,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatDate,
  formatDateTime,
  formatMac,
  formatMoney,
  isValidDeviceId,
  normalizeDeviceId,
  post,
  type LicenseRecord,
  type PlanId,
  type RegistryStats,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "novastream_dashboard_token";

type LicensesPayload = { licenses: LicenseRecord[]; stats: RegistryStats };
type StatusFilter = "all" | "active" | "expired" | "suspended" | "revoked";

export default function Dashboard() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");

  const signOut = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
  }, []);

  const saveToken = useCallback((value: string): void => {
    localStorage.setItem(TOKEN_KEY, value);
    setToken(value);
  }, []);

  if (!token) return <LoginScreen onAuthenticated={saveToken} />;
  return <Console token={token} onSignOut={signOut} />;
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");

  const login = useMutation({
    mutationFn: (value: string) => post<{ token: string }>("/api/admin/login", { password: value }),
    onSuccess: (data) => onAuthenticated(data.token),
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Accesso non riuscito"),
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          login.mutate(password);
        }}
        className="panel animate-rise relative w-full max-w-sm p-8"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary glow-ring">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Area gestione</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Riservata al titolare di NovaStream.
        </p>
        <Label htmlFor="password" className="mt-7 block text-sm">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 h-12 border-border/80 bg-secondary/60"
        />
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={login.isPending} className="mt-6 h-12 w-full gap-2">
          {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Entra
        </Button>
        <Link
          to="/"
          className="mt-5 block text-center text-xs text-muted-foreground transition hover:text-foreground"
        >
          Torna al sito
        </Link>
      </form>
    </div>
  );
}

function Console({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const licenses = useQuery({
    queryKey: ["licenses"],
    queryFn: () => post<LicensesPayload>("/api/admin/licenses", {}, token),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (licenses.error instanceof Error && licenses.error.message === "unauthorized") onSignOut();
  }, [licenses.error, onSignOut]);

  const invalidate = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: ["licenses"] });
  }, [queryClient]);

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      post<{ ok: boolean }>(path, body, token),
    onSuccess: () => {
      invalidate();
      toast.success("Fatto");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Operazione non riuscita"),
  });

  const rows = useMemo(() => {
    const all = licenses.data?.licenses ?? [];
    const needle = normalizeDeviceId(search);
    const plain = search.trim().toLowerCase();
    return all.filter((row) => {
      const matchesSearch =
        !search.trim() ||
        row.deviceId.includes(needle) ||
        row.email.toLowerCase().includes(plain) ||
        row.label.toLowerCase().includes(plain);
      if (!matchesSearch) return false;
      switch (filter) {
        case "active":
          return row.status === "active" && !row.expired;
        case "expired":
          return row.status === "active" && row.expired;
        case "suspended":
          return row.status === "suspended";
        case "revoked":
          return row.status === "revoked";
        default:
          return true;
      }
    });
  }, [licenses.data, search, filter]);

  const stats = licenses.data?.stats;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />

      <header className="relative border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">NovaStream</div>
              <div className="text-[11px] text-muted-foreground">Area gestione</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={invalidate}
              className="gap-1.5 text-muted-foreground"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", licenses.isFetching && "animate-spin")} />
              Aggiorna
            </Button>
            <Button variant="ghost" size="sm" onClick={onSignOut} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 py-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            label="Licenze attive"
            value={String(stats?.active ?? 0)}
            tone="text-accent"
          />
          <StatCard
            icon={PauseCircle}
            label="Sospese o scadute"
            value={String((stats?.suspended ?? 0) + (stats?.expired ?? 0))}
            tone="text-warning"
          />
          <StatCard
            icon={CircleDollarSign}
            label="Incasso ultimi 30 giorni"
            value={formatMoney(stats?.revenueCents30d ?? 0)}
            tone="text-primary"
          />
          <StatCard
            icon={CircleDollarSign}
            label="Incasso totale"
            value={formatMoney(stats?.revenueCents ?? 0)}
            tone="text-foreground"
          />
        </section>

        <ManualGrant token={token} onDone={invalidate} />

        <section className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold">Clienti</h2>
            <div className="flex flex-1 items-center gap-2 sm:max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cerca MAC, email o nome"
                  className="h-10 border-border/80 bg-secondary/60 pl-9"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["all", "Tutte"],
                ["active", "Attive"],
                ["expired", "Scadute"],
                ["suspended", "Sospese"],
                ["revoked", "Revocate"],
              ] as [StatusFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                  filter === value
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2.5">
            {licenses.isLoading && (
              <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carico le licenze…
              </div>
            )}
            {!licenses.isLoading && rows.length === 0 && (
              <div className="panel p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Nessuna licenza da mostrare. Appariranno qui appena arriva il primo acquisto.
                </p>
              </div>
            )}
            {rows.map((row) => (
              <LicenseRow
                key={row.deviceId}
                row={row}
                busy={action.isPending}
                onAction={(path, body) => action.mutate({ path, body })}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="panel p-5">
      <Icon className={cn("h-4.5 w-4.5", tone)} />
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ManualGrant({ token, onDone }: { token: string; onDone: () => void }) {
  const [open, setOpen] = useState<boolean>(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [plan, setPlan] = useState<PlanId>("annual");

  const grant = useMutation({
    mutationFn: () =>
      post<{ ok: boolean }>(
        "/api/admin/grant",
        { deviceId: normalizeDeviceId(deviceId), plan, label },
        token,
      ),
    onSuccess: () => {
      toast.success("Licenza creata");
      setDeviceId("");
      setLabel("");
      setOpen(false);
      onDone();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Creazione non riuscita"),
  });

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="mt-6 h-11 gap-2">
        <Plus className="h-4 w-4" />
        Attiva un dispositivo a mano
      </Button>
    );
  }

  return (
    <div className="panel mt-6 p-5">
      <h3 className="text-base font-bold">Attivazione manuale</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Da usare per omaggi, rimborsi o pagamenti ricevuti fuori dal sito.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr_auto]">
        <Input
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          placeholder="MAC o ID dispositivo"
          className="mono h-11 border-border/80 bg-secondary/60 uppercase"
        />
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Nome cliente (facoltativo)"
          className="h-11 border-border/80 bg-secondary/60"
        />
        <div className="flex gap-2">
          {(["annual", "lifetime"] as PlanId[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlan(value)}
              className={cn(
                "rounded-lg border px-3 text-xs font-medium transition",
                plan === value
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border/70 text-muted-foreground",
              )}
            >
              {value === "annual" ? "12 mesi" : "A vita"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => grant.mutate()}
          disabled={!isValidDeviceId(deviceId) || grant.isPending}
          className="h-10 gap-2"
        >
          {grant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Crea licenza
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} className="h-10">
          Annulla
        </Button>
      </div>
    </div>
  );
}

function LicenseRow({
  row,
  busy,
  onAction,
}: {
  row: LicenseRecord;
  busy: boolean;
  onAction: (path: string, body: Record<string, unknown>) => void;
}) {
  const state = row.status === "active" && row.expired ? "expired" : row.status;
  const tone: Record<string, string> = {
    active: "border-accent/40 bg-accent/10 text-accent",
    expired: "border-warning/40 bg-warning/10 text-warning",
    suspended: "border-warning/40 bg-warning/10 text-warning",
    revoked: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  const stateLabel: Record<string, string> = {
    active: "Attiva",
    expired: "Scaduta",
    suspended: "Sospesa",
    revoked: "Revocata",
  };

  return (
    <div className="panel p-4 transition hover:border-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(row.deviceId);
                toast.success("ID copiato");
              }}
              className="mono group flex items-center gap-1.5 text-sm font-semibold tracking-wide"
            >
              {formatMac(row.deviceId)}
              <Copy className="h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </button>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                tone[state],
              )}
            >
              {stateLabel[state]}
            </span>
            <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {row.plan === "lifetime" ? "A vita" : "12 mesi"}
            </span>
            {row.source === "manual" && (
              <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[10px] text-muted-foreground">
                manuale
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {row.label && <span className="text-foreground/80">{row.label}</span>}
            {row.email && <span>{row.email}</span>}
            <span>
              Scadenza: {row.expiresAt ? formatDate(row.expiresAt) : "nessuna"}
            </span>
            <span>Ultimo accesso: {formatDateTime(row.lastSeenAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {row.status !== "active" && (
            <RowButton
              icon={PlayCircle}
              label="Riattiva"
              disabled={busy}
              onClick={() => onAction("/api/admin/set-status", { deviceId: row.deviceId, status: "active" })}
            />
          )}
          {row.status === "active" && (
            <RowButton
              icon={PauseCircle}
              label="Sospendi"
              disabled={busy}
              onClick={() =>
                onAction("/api/admin/set-status", { deviceId: row.deviceId, status: "suspended" })
              }
            />
          )}
          {row.expiresAt !== null && (
            <RowButton
              icon={CalendarPlus}
              label="+1 anno"
              disabled={busy}
              onClick={() => onAction("/api/admin/extend", { deviceId: row.deviceId, days: 365 })}
            />
          )}
          {row.status !== "revoked" && (
            <RowButton
              icon={Ban}
              label="Revoca"
              danger
              disabled={busy}
              onClick={() =>
                onAction("/api/admin/set-status", { deviceId: row.deviceId, status: "revoked" })
              }
            />
          )}
          <RowButton
            icon={Trash2}
            label="Elimina"
            danger
            disabled={busy}
            onClick={() => {
              if (window.confirm("Eliminare definitivamente questa licenza?")) {
                onAction("/api/admin/remove", { deviceId: row.deviceId });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function RowButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof Ban;
  label: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40",
        danger
          ? "text-destructive hover:border-destructive/50 hover:bg-destructive/10"
          : "text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

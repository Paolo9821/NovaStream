import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Crown,
  History,
  Hourglass,
  Inbox,
  Loader2,
  LockKeyhole,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Mail,
  Trash2,
  TrendingUp,
  Undo2,
  User,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  daysUntil,
  formatDate,
  formatDateTime,
  formatMac,
  formatMonth,
  formatMoney,
  isValidDeviceId,
  normalizeDeviceId,
  post,
  type LicenseRecord,
  type OrderRecord,
  type PlanId,
  type RegistryStats,
  type SecurityInfo,
  type SupportTicket,
  type TicketStatus,
  type TrialRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "novastream_dashboard_token";
const USER_KEY = "novastream_dashboard_user";

/** Only digits, at most six: what every authenticator app produces. */
const cleanCode = (raw: string): string => raw.replace(/\D/g, "").slice(0, 6);

type LicensesPayload = {
  licenses: LicenseRecord[];
  stats: RegistryStats;
  trials: TrialRecord[];
  orders: OrderRecord[];
};
type TicketsPayload = { tickets: SupportTicket[]; openCount: number };

/** Labels for the topic chosen in the contact form on the store. */
const TOPIC_LABELS: Record<string, string> = {
  subscription: "Abbonamento non funziona",
  payment: "Problema di pagamento",
  activation: "Attivazione o cambio dispositivo",
  other: "Altro",
};

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
  const [username, setUsername] = useState<string>(() => localStorage.getItem(USER_KEY) ?? "");
  const [password, setPassword] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [needsCode, setNeedsCode] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const login = useMutation({
    mutationFn: () =>
      post<{ token: string }>("/api/admin/login", {
        username,
        password,
        code: code.trim(),
      }),
    onSuccess: (data) => {
      localStorage.setItem(USER_KEY, username.trim());
      onAuthenticated(data.token);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.twofaRequired) {
        setNeedsCode(true);
        setCode("");
        setError(
          err.message === "two-factor code required"
            ? "Inserisci il codice a 6 cifre dell'app di autenticazione."
            : "Codice non valido o già usato. Attendi il codice successivo.",
        );
        return;
      }
      if (err instanceof ApiError && err.status === 429) {
        setError(
          `Troppi tentativi falliti. Riprova tra ${Math.ceil(err.retryInSeconds / 60)} minuti.`,
        );
        return;
      }
      setError(
        err instanceof Error && err.message === "wrong username or password"
          ? "Nome utente o password non corretti."
          : err instanceof Error
            ? err.message
            : "Accesso non riuscito",
      );
    },
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          login.mutate();
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
        <Label htmlFor="username" className="mt-7 block text-sm">
          Nome utente
        </Label>
        <Input
          id="username"
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-2 h-12 border-border/80 bg-secondary/60"
        />
        <Label htmlFor="password" className="mt-4 block text-sm">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 h-12 border-border/80 bg-secondary/60"
        />
        {needsCode && (
          <div className="animate-rise">
            <Label htmlFor="code" className="mt-4 block text-sm">
              Codice di verifica
            </Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(cleanCode(event.target.value))}
              className="mono mt-2 h-12 border-border/80 bg-secondary/60 text-center text-lg tracking-[0.4em]"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Aprí Authy sul telefono e copia il codice a 6 cifre di NovaStream.
            </p>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={login.isPending || !username.trim() || !password}
          className="mt-6 h-12 w-full gap-2"
        >
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

  const matching = useMemo(() => {
    const all = licenses.data?.licenses ?? [];
    const needle = normalizeDeviceId(search);
    const plain = search.trim().toLowerCase();
    if (!search.trim()) return all;
    return all.filter(
      (row) =>
        row.deviceId.includes(needle) ||
        // A customer quoting their MAC must find their licence even when the
        // purchase was recorded against the app's device id.
        (row.aliases ?? []).some((alias) => alias.includes(needle)) ||
        row.email.toLowerCase().includes(plain) ||
        row.label.toLowerCase().includes(plain),
    );
  }, [licenses.data, search]);

  /** One list per kind of customer, so each group can be read on its own. */
  const groups = useMemo(() => {
    const live = matching.filter((row) => row.status === "active" && !row.expired);
    return {
      lifetime: live.filter((row) => row.plan === "lifetime"),
      subscription: live.filter((row) => row.plan !== "lifetime"),
      expired: matching.filter((row) => row.status === "active" && row.expired),
      halted: matching.filter((row) => row.status === "suspended" || row.status === "revoked"),
    };
  }, [matching]);

  /** Devices still on the free week. Whoever bought a licence leaves this list. */
  const trials = useMemo(() => {
    const all = licenses.data?.trials ?? [];
    const needle = normalizeDeviceId(search);
    const found = search.trim()
      ? all.filter(
          (trial) =>
            trial.deviceId.includes(needle) ||
            trial.aliases.some((alias) => alias.includes(needle)),
        )
      : all;
    return found.filter((trial) => !trial.converted);
  }, [licenses.data, search]);

  const stats = licenses.data?.stats;
  const orders = licenses.data?.orders ?? [];
  const runAction = useCallback(
    (path: string, body: Record<string, unknown>): void => action.mutate({ path, body }),
    [action],
  );

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
            icon={Crown}
            label="Utenti a vita"
            value={String(stats?.lifetime ?? 0)}
            tone="text-warning"
          />
          <StatCard
            icon={Users}
            label="Abbonamenti attivi"
            value={String(stats?.subscription ?? 0)}
            tone="text-accent"
          />
          <StatCard
            icon={Hourglass}
            label="Utenti in prova"
            value={String(stats?.trialsActive ?? 0)}
            tone="text-primary"
          />
          <StatCard
            icon={PauseCircle}
            label="Da rinnovare o bloccate"
            value={String((stats?.suspended ?? 0) + (stats?.expired ?? 0) + (stats?.revoked ?? 0))}
            tone="text-muted-foreground"
          />
        </section>

        <RevenuePanel
          orders={orders}
          totalCents={stats?.revenueCents ?? 0}
          last30Cents={stats?.revenueCents30d ?? 0}
          loading={licenses.isLoading}
        />

        <ManualGrant token={token} onDone={invalidate} />

        <SupportInbox token={token} />

        <SecurityPanel token={token} />

        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Utenti</h2>
              <p className="text-xs text-muted-foreground">
                Divisi per tipo. La ricerca filtra tutti i gruppi insieme.
              </p>
            </div>
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cerca MAC, email o nome"
                className="h-10 border-border/80 bg-secondary/60 pl-9"
              />
            </div>
          </div>

          {licenses.isLoading && (
            <div className="panel mt-4 flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carico gli utenti…
            </div>
          )}

          {!licenses.isLoading && (
            <div className="mt-4 space-y-4">
              <TrialSection trials={trials} reinstalls={stats?.reinstalls ?? 0} />

              <UserGroup
                icon={Crown}
                tone="text-warning"
                title="Utenti a vita"
                hint="Licenza senza scadenza, pagata una volta sola."
                empty="Nessuna licenza a vita."
                rows={groups.lifetime}
                busy={action.isPending}
                onAction={runAction}
              />

              <UserGroup
                icon={CalendarClock}
                tone="text-accent"
                title="Abbonamenti attivi"
                hint="Licenze annuali in corso, con data di rinnovo."
                empty="Nessun abbonamento attivo."
                rows={groups.subscription}
                busy={action.isPending}
                onAction={runAction}
              />

              <UserGroup
                icon={RotateCcw}
                tone="text-warning"
                title="Abbonamenti scaduti"
                hint="Hanno pagato in passato: sono i rinnovi da recuperare."
                empty="Nessun abbonamento scaduto."
                rows={groups.expired}
                busy={action.isPending}
                onAction={runAction}
                collapsed
              />

              <UserGroup
                icon={Ban}
                tone="text-destructive"
                title="Sospesi e revocati"
                hint="Bloccati a mano da questa dashboard."
                empty="Nessun utente bloccato."
                rows={groups.halted}
                busy={action.isPending}
                onAction={runAction}
                collapsed
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * Requests sent from the contact form on the store. They arrive here directly,
 * so nothing depends on an email inbox being watched.
 */
function SupportInbox({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [showClosed, setShowClosed] = useState<boolean>(false);

  const inbox = useQuery({
    queryKey: ["tickets"],
    queryFn: () => post<TicketsPayload>("/api/admin/tickets", {}, token),
    refetchInterval: 60_000,
  });

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

  const all = useMemo(() => inbox.data?.tickets ?? [], [inbox.data]);
  const visible = useMemo(
    () => (showClosed ? all : all.filter((ticket) => ticket.status !== "closed")),
    [all, showClosed],
  );
  const openCount = inbox.data?.openCount ?? 0;
  const newCount = all.filter((ticket) => ticket.status === "new").length;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              newCount > 0 ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
            )}
          >
            <Inbox className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              Richieste di assistenza
              {newCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {newCount} nuove
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              {openCount === 0
                ? "Nessuna richiesta da gestire."
                : `${openCount} da gestire · arrivano dal modulo del sito`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClosed((value) => !value)}
            className="text-muted-foreground"
          >
            {showClosed ? "Nascondi chiuse" : "Mostra chiuse"}
          </Button>
          <Button variant="ghost" size="sm" onClick={refresh} className="gap-1.5 text-muted-foreground">
            <RefreshCw className={cn("h-3.5 w-3.5", inbox.isFetching && "animate-spin")} />
            Aggiorna
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {inbox.isLoading && (
          <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carico le richieste…
          </div>
        )}
        {!inbox.isLoading && visible.length === 0 && (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            {all.length === 0
              ? "Nessuna richiesta ricevuta. Quando un cliente scrive dal sito, comparirà qui."
              : "Tutto gestito. Le richieste chiuse sono nascoste."}
          </div>
        )}
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
    </section>
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

/** Owner account state plus the two-factor enrolment flow. */
function SecurityPanel({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [enrolling, setEnrolling] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");
  const [disablePassword, setDisablePassword] = useState<string>("");
  const [disableCode, setDisableCode] = useState<string>("");
  const [disabling, setDisabling] = useState<boolean>(false);

  const security = useQuery({
    queryKey: ["security"],
    queryFn: () => post<SecurityInfo>("/api/admin/security", {}, token),
  });

  const refresh = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: ["security"] });
  }, [queryClient]);

  const setup = useMutation({
    mutationFn: () => post<{ secret: string; otpauth: string }>("/api/admin/2fa/setup", {}, token),
    onSuccess: () => setEnrolling(true),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Impossibile avviare la configurazione"),
  });

  const enable = useMutation({
    mutationFn: () => post<{ ok: boolean }>("/api/admin/2fa/enable", { code }, token),
    onSuccess: () => {
      toast.success("Verifica in due passaggi attiva");
      setEnrolling(false);
      setCode("");
      setup.reset();
      refresh();
    },
    onError: () => toast.error("Codice non valido. Riprova con quello mostrato adesso."),
  });

  const disable = useMutation({
    mutationFn: () =>
      post<{ ok: boolean }>(
        "/api/admin/2fa/disable",
        { password: disablePassword, code: disableCode },
        token,
      ),
    onSuccess: () => {
      toast.success("Verifica in due passaggi disattivata");
      setDisabling(false);
      setDisablePassword("");
      setDisableCode("");
      refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Disattivazione non riuscita"),
  });

  const info = security.data;
  const enabled = info?.twofaEnabled === true;

  return (
    <section className="panel mt-8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              enabled ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning",
            )}
          >
            {enabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold">Sicurezza dell'accesso</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {info?.username ?? "…"}
              </span>
              <span>
                {enabled
                  ? "Verifica in due passaggi attiva"
                  : "Protetto solo da nome utente e password"}
              </span>
            </p>
          </div>
        </div>
        {!enabled && !enrolling && (
          <Button
            onClick={() => setup.mutate()}
            disabled={setup.isPending || security.isLoading}
            className="h-10 gap-2"
          >
            {setup.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            Attiva la verifica in due passaggi
          </Button>
        )}
        {enabled && !disabling && (
          <Button variant="ghost" onClick={() => setDisabling(true)} className="h-10">
            Disattiva
          </Button>
        )}
      </div>

      {info?.usernameConfigured === false && (
        <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Stai usando il nome utente predefinito «admin». Impostane uno personale per rendere
          l'accesso più difficile da indovinare.
        </p>
      )}

      {enrolling && setup.data && (
        <div className="mt-5 grid gap-5 border-t border-border/60 pt-5 sm:grid-cols-[auto_1fr]">
          <div className="mx-auto rounded-2xl bg-white p-3 sm:mx-0">
            <QRCodeSVG value={setup.data.otpauth} size={168} level="M" />
          </div>
          <div>
            <p className="text-sm font-semibold">1. Inquadra il codice con Authy</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Apri Authy sul telefono, tocca «Aggiungi account» e inquadra questo codice. Funziona
              anche con Google Authenticator, Microsoft Authenticator e 1Password.
            </p>
            <p className="mt-3 text-sm font-semibold">Se non puoi inquadrare</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(setup.data.secret);
                toast.success("Chiave copiata");
              }}
              className="mono mt-1 flex items-center gap-2 break-all rounded-lg border border-border/70 px-3 py-2 text-left text-xs"
            >
              {setup.data.secret}
              <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
            <p className="mt-4 text-sm font-semibold">2. Conferma il codice a 6 cifre</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(cleanCode(event.target.value))}
                className="mono h-11 w-36 border-border/80 bg-secondary/60 text-center tracking-[0.3em]"
              />
              <Button
                onClick={() => enable.mutate()}
                disabled={code.length !== 6 || enable.isPending}
                className="h-11 gap-2"
              >
                {enable.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Conferma e attiva
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEnrolling(false);
                  setCode("");
                  setup.reset();
                }}
                className="h-11"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {enabled && disabling && (
        <div className="mt-5 border-t border-border/60 pt-5">
          <p className="text-sm text-muted-foreground">
            Per disattivare la verifica servono la password e un codice valido: così nessuno può
            farlo da una sessione lasciata aperta.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              type="password"
              placeholder="Password"
              value={disablePassword}
              onChange={(event) => setDisablePassword(event.target.value)}
              className="h-11 w-52 border-border/80 bg-secondary/60"
            />
            <Input
              inputMode="numeric"
              placeholder="123456"
              value={disableCode}
              onChange={(event) => setDisableCode(cleanCode(event.target.value))}
              className="mono h-11 w-36 border-border/80 bg-secondary/60 text-center tracking-[0.3em]"
            />
            <Button
              variant="destructive"
              onClick={() => disable.mutate()}
              disabled={disableCode.length !== 6 || !disablePassword || disable.isPending}
              className="h-11 gap-2"
            >
              {disable.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Disattiva
            </Button>
            <Button variant="ghost" onClick={() => setDisabling(false)} className="h-11">
              Annulla
            </Button>
          </div>
        </div>
      )}
    </section>
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

type RevenueView = "month" | "year";

type Cursor = { year: number; month: number };

type ChartBucket = { key: string; label: string; caption: string; cents: number; count: number };

const MONTHS_SHORT: string[] = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

function inPeriod(ms: number, view: RevenueView, cursor: Cursor): boolean {
  const date = new Date(ms);
  if (date.getFullYear() !== cursor.year) return false;
  return view === "year" || date.getMonth() === cursor.month;
}

function stepCursor(cursor: Cursor, delta: number, view: RevenueView): Cursor {
  if (view === "year") return { year: cursor.year + delta, month: cursor.month };
  const index = cursor.year * 12 + cursor.month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

function sumIn(orders: OrderRecord[], view: RevenueView, cursor: Cursor): number {
  return orders
    .filter((order) => inPeriod(order.createdAt, view, cursor))
    .reduce((sum, order) => sum + order.amountCents, 0);
}

function ChartTip({ active, payload }: TooltipProps<number, string>) {
  const bucket = payload?.[0]?.payload as ChartBucket | undefined;
  if (active !== true || !bucket) return null;
  return (
    <div className="rounded-xl border border-border/80 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="text-xs text-muted-foreground">{bucket.caption}</div>
      <div className="mt-0.5 text-sm font-bold">{formatMoney(bucket.cents)}</div>
      <div className="text-[11px] text-muted-foreground">
        {bucket.count === 0
          ? "nessun acquisto"
          : bucket.count === 1
            ? "1 acquisto"
            : `${bucket.count} acquisti`}
      </div>
    </div>
  );
}

/**
 * Earnings over time. Every settled purchase stays in the registry, so the month
 * and year views can be browsed backwards indefinitely and keep filling in as new
 * orders arrive.
 */
function RevenuePanel({
  orders,
  totalCents,
  last30Cents,
  loading,
}: {
  orders: OrderRecord[];
  totalCents: number;
  last30Cents: number;
  loading: boolean;
}) {
  const [view, setView] = useState<RevenueView>("month");
  const [cursor, setCursor] = useState<Cursor>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Orders arrive oldest first, so the first one marks how far back one can go.
  const bounds = useMemo(() => {
    const now = new Date();
    const first = orders.length > 0 ? new Date(orders[0].createdAt) : now;
    return {
      minIndex: first.getFullYear() * 12 + first.getMonth(),
      maxIndex: now.getFullYear() * 12 + now.getMonth(),
      minYear: first.getFullYear(),
      maxYear: now.getFullYear(),
    };
  }, [orders]);

  const index = cursor.year * 12 + cursor.month;
  const canPrev = view === "year" ? cursor.year > bounds.minYear : index > bounds.minIndex;
  const canNext = view === "year" ? cursor.year < bounds.maxYear : index < bounds.maxIndex;

  const shift = useCallback(
    (delta: number): void => setCursor((prev) => stepCursor(prev, delta, view)),
    [view],
  );

  const buckets = useMemo<ChartBucket[]>(() => {
    if (view === "year") {
      const list: ChartBucket[] = MONTHS_SHORT.map((label, month) => ({
        key: `${cursor.year}-${month}`,
        label,
        caption: formatMonth(cursor.year, month),
        cents: 0,
        count: 0,
      }));
      for (const order of orders) {
        const date = new Date(order.createdAt);
        if (date.getFullYear() !== cursor.year) continue;
        const slot = list[date.getMonth()];
        slot.cents += order.amountCents;
        slot.count += 1;
      }
      return list;
    }

    const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const list: ChartBucket[] = Array.from({ length: days }, (_, offset) => ({
      key: `${cursor.year}-${cursor.month}-${offset + 1}`,
      label: String(offset + 1),
      caption: formatDate(new Date(cursor.year, cursor.month, offset + 1).getTime()),
      cents: 0,
      count: 0,
    }));
    for (const order of orders) {
      const date = new Date(order.createdAt);
      if (date.getFullYear() !== cursor.year || date.getMonth() !== cursor.month) continue;
      const slot = list[date.getDate() - 1];
      slot.cents += order.amountCents;
      slot.count += 1;
    }
    return list;
  }, [orders, view, cursor]);

  const periodOrders = useMemo(
    () => orders.filter((order) => inPeriod(order.createdAt, view, cursor)).reverse(),
    [orders, view, cursor],
  );

  const periodCents = buckets.reduce((sum, bucket) => sum + bucket.cents, 0);
  const peakCents = buckets.reduce((max, bucket) => Math.max(max, bucket.cents), 0);
  const previousCents = sumIn(orders, view, stepCursor(cursor, -1, view));
  const delta = previousCents === 0 ? null : Math.round(((periodCents - previousCents) / previousCents) * 100);
  const periodLabel = view === "year" ? String(cursor.year) : formatMonth(cursor.year, cursor.month);

  return (
    <section className="panel mt-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            Incassi
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold tracking-tight">{formatMoney(periodCents)}</span>
            <span className="text-sm capitalize text-muted-foreground">{periodLabel}</span>
            {delta !== null && (
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  delta >= 0 ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive",
                )}
              >
                <TrendingUp className={cn("h-3 w-3", delta < 0 && "rotate-180")} />
                {delta >= 0 ? "+" : ""}
                {delta}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {periodOrders.length === 0
              ? "Nessun acquisto in questo periodo"
              : `${periodOrders.length} ${periodOrders.length === 1 ? "acquisto" : "acquisti"} · confronto con il periodo precedente: ${formatMoney(previousCents)}`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex rounded-full border border-border/70 p-0.5">
            {(
              [
                ["month", "Mese"],
                ["year", "Anno"],
              ] as [RevenueView, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-medium transition",
                  view === value
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              disabled={!canPrev}
              aria-label="Periodo precedente"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition enabled:hover:border-primary/50 enabled:hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              disabled={!canNext}
              aria-label="Periodo successivo"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition enabled:hover:border-primary/50 enabled:hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-2 pb-2">
        <div className="h-56 w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carico lo storico…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={view === "month" ? 3 : 0}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(value: number) => `€${Math.round(value / 100)}`}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <Tooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--secondary))", opacity: 0.45 }} />
                <Bar dataKey="cents" radius={[5, 5, 2, 2]} maxBarSize={38} animationDuration={450}>
                  {buckets.map((bucket) => (
                    <Cell
                      key={bucket.key}
                      fill={
                        bucket.cents === 0
                          ? "hsl(var(--secondary))"
                          : bucket.cents === peakCents
                            ? "hsl(var(--accent))"
                            : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-px border-t border-border/60 bg-border/60 sm:grid-cols-3">
        <MiniStat label="Incasso totale" value={formatMoney(totalCents)} />
        <MiniStat label="Ultimi 30 giorni" value={formatMoney(last30Cents)} />
        <MiniStat label="Acquisti registrati" value={String(orders.length)} />
      </div>

      <div className="border-t border-border/60 p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Acquisti di {periodLabel}
        </div>
        {periodOrders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {orders.length === 0
              ? "Nessun acquisto ancora registrato. Il primo comparirà qui e nel grafico."
              : "Nessun acquisto in questo periodo. Usa le frecce per spostarti."}
          </p>
        ) : (
          <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {periodOrders.map((order) => (
              <div
                key={order.orderId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/60 px-3 py-2 text-xs"
              >
                <span className="text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    order.plan === "lifetime"
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-accent/40 bg-accent/10 text-accent",
                  )}
                >
                  {order.plan === "lifetime" ? "A vita" : "12 mesi"}
                </span>
                <span className="mono text-muted-foreground">{formatMac(order.deviceId)}</span>
                {order.email && <span className="truncate text-muted-foreground">{order.email}</span>}
                <span className="ml-auto font-bold">{formatMoney(order.amountCents)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}

/** Devices on the free week, with how often the app was installed again. */
function TrialSection({ trials, reinstalls }: { trials: TrialRecord[]; reinstalls: number }) {
  const [open, setOpen] = useState<boolean>(true);
  const [showExpired, setShowExpired] = useState<boolean>(false);
  const running = trials.filter((trial) => !trial.expired);
  const expired = trials.filter((trial) => trial.expired);
  const visible = showExpired ? [...running, ...expired] : running;

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Hourglass className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold">
              Utenti in prova
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                {running.length}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {expired.length} prove scadute · {reinstalls}{" "}
              {reinstalls === 1 ? "reinstallazione" : "reinstallazioni"} in totale
            </p>
          </div>
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition",
              open && "rotate-180",
            )}
          />
        </button>
        {open && expired.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExpired((value) => !value)}
            className="text-xs text-muted-foreground"
          >
            {showExpired ? "Nascondi scadute" : "Mostra scadute"}
          </Button>
        )}
      </div>

      {open && (
        <div className="space-y-2 border-t border-border/60 p-3">
          {visible.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Nessuna prova in corso. I nuovi dispositivi compaiono qui al primo avvio.
            </p>
          ) : (
            visible.map((trial) => <TrialRow key={trial.deviceId} trial={trial} />)
          )}
        </div>
      )}
    </div>
  );
}

function TrialRow({ trial }: { trial: TrialRecord }) {
  const left = daysUntil(trial.expiresAt);
  const reinstalls = Math.max(0, trial.installs - 1);

  return (
    <div className="rounded-xl border border-border/60 p-3.5 transition hover:border-border">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(trial.deviceId);
            toast.success("ID copiato");
          }}
          className="mono group flex items-center gap-1.5 text-sm font-semibold tracking-wide"
        >
          {formatMac(trial.deviceId)}
          <Copy className="h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
        </button>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            trial.expired
              ? "border-border/70 bg-secondary/60 text-muted-foreground"
              : "border-primary/50 bg-primary/15 text-primary",
          )}
        >
          {trial.expired ? "Prova scaduta" : left === 0 ? "Ultimo giorno" : `${left} giorni rimasti`}
        </span>
        {reinstalls > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[10px] font-bold text-warning">
            <RotateCcw className="h-3 w-3" />
            Reinstallato {reinstalls} {reinstalls === 1 ? "volta" : "volte"}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {trial.aliases.length > 0 && (
          <span className="mono">Anche: {trial.aliases.map(formatMac).join(" · ")}</span>
        )}
        <span>Prima apertura: {formatDate(trial.startedAt)}</span>
        <span>Fine prova: {formatDate(trial.expiresAt)}</span>
        <span>Ultimo accesso: {formatDateTime(trial.lastSeenAt)}</span>
      </div>
    </div>
  );
}

/** One collapsible block of licences, all sharing the same kind of plan or state. */
function UserGroup({
  icon: Icon,
  tone,
  title,
  hint,
  empty,
  rows,
  busy,
  onAction,
  collapsed,
}: {
  icon: typeof Users;
  tone: string;
  title: string;
  hint: string;
  empty: string;
  rows: LicenseRecord[];
  busy: boolean;
  onAction: (path: string, body: Record<string, unknown>) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(collapsed !== true);

  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-secondary/30"
      >
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary", tone)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold">
            {title}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {rows.length}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </div>
        <ChevronDown
          className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-border/60 p-3">
          {rows.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{empty}</p>
          ) : (
            rows.map((row) => (
              <LicenseRow key={row.deviceId} row={row} busy={busy} onAction={onAction} />
            ))
          )}
        </div>
      )}
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
            {(row.aliases ?? []).length > 0 && (
              <span className="mono">Anche: {(row.aliases ?? []).map(formatMac).join(" · ")}</span>
            )}
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

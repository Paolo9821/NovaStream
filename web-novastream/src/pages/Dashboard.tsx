import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Crown,
  Gift,
  History,
  Hourglass,
  Inbox,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Settings,
  TicketPercent,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodesView, type CodeFolder } from "@/components/dashboard/CodesView";
import { CustomersView, useCustomerFolders, type CustomerFolder } from "@/components/dashboard/CustomersView";
import { GrantDialog } from "@/components/dashboard/LicenseDialogs";
import { Overview, type OverviewTarget } from "@/components/dashboard/Overview";
import { RevenuePanel } from "@/components/dashboard/RevenuePanel";
import { SecurityPanel } from "@/components/dashboard/SecurityPanel";
import { SupportInbox, type TicketFolder } from "@/components/dashboard/SupportInbox";
import { SectionHeader, SubTabs } from "@/components/dashboard/ui";
import { useLicenses, usePromos, useTickets } from "@/hooks/useAdminData";
import { ApiError, post } from "@/lib/api";
import { codeState } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "novastream_dashboard_token";
const USER_KEY = "novastream_dashboard_user";

/** Only digits, at most six: what every authenticator app produces. */
const cleanCode = (raw: string): string => raw.replace(/\D/g, "").slice(0, 6);

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

// ---- Navigation ----------------------------------------------------------

type SectionId = "overview" | "customers" | "sales" | "codes" | "support" | "settings";

type Location = {
  section: SectionId;
  customers: CustomerFolder;
  codes: CodeFolder;
  support: TicketFolder;
};

const DEFAULT_LOCATION: Location = {
  section: "overview",
  customers: "subscription",
  codes: "discount",
  support: "new",
};

type SubItem = { id: string; label: string; icon: LucideIcon; count?: number };

/** Reads "#customers/expired" style addresses so a refresh keeps the same folder. */
function readHash(): Location {
  const [section, folder] = window.location.hash.replace(/^#/, "").split("/");
  const location = { ...DEFAULT_LOCATION };
  if (["overview", "customers", "sales", "codes", "support", "settings"].includes(section)) {
    location.section = section as SectionId;
  }
  if (location.section === "customers" && ["trial", "subscription", "lifetime", "expired", "blocked"].includes(folder)) {
    location.customers = folder as CustomerFolder;
  }
  if (location.section === "codes" && ["discount", "gift", "history"].includes(folder)) {
    location.codes = folder as CodeFolder;
  }
  if (location.section === "support" && ["new", "open", "closed"].includes(folder)) {
    location.support = folder as TicketFolder;
  }
  return location;
}

function hashOf(location: Location): string {
  switch (location.section) {
    case "customers":
      return `#customers/${location.customers}`;
    case "codes":
      return `#codes/${location.codes}`;
    case "support":
      return `#support/${location.support}`;
    default:
      return `#${location.section}`;
  }
}

function Console({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<Location>(readHash);
  const [granting, setGranting] = useState<boolean>(false);

  const licenses = useLicenses(token);
  const tickets = useTickets(token);
  const promos = usePromos(token);
  const folders = useCustomerFolders(licenses.data, "");

  useEffect(() => {
    const unauthorized = [licenses.error, tickets.error, promos.error].some(
      (error) => error instanceof Error && error.message === "unauthorized",
    );
    if (unauthorized) onSignOut();
  }, [licenses.error, tickets.error, promos.error, onSignOut]);

  useEffect(() => {
    const next = hashOf(location);
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }, [location]);

  const go = useCallback((patch: Partial<Location>): void => {
    setLocation((current) => ({ ...current, ...patch }));
    window.scrollTo({ top: 0 });
  }, []);

  const goTarget = useCallback(
    (target: OverviewTarget): void => {
      const [section, folder] = target.split("/");
      if (section === "customers") go({ section: "customers", customers: folder as CustomerFolder });
      else if (section === "codes") go({ section: "codes", codes: folder as CodeFolder });
      else if (section === "support") go({ section: "support", support: folder as TicketFolder });
      else go({ section: section as SectionId });
    },
    [go],
  );

  const refreshAll = useCallback((): void => {
    for (const key of ["licenses", "tickets", "promos", "security"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient]);

  const allTickets = tickets.data?.tickets ?? [];
  const ticketCount = (status: TicketFolder): number => allTickets.filter((ticket) => ticket.status === status).length;
  const codes = promos.data?.codes ?? [];
  const fetching = licenses.isFetching || tickets.isFetching || promos.isFetching;

  const sections: { id: SectionId; label: string; icon: LucideIcon; badge?: number; children?: SubItem[] }[] = [
    { id: "overview", label: "Panoramica", icon: LayoutDashboard },
    {
      id: "customers",
      label: "Clienti",
      icon: Users,
      children: [
        { id: "trial", label: "In prova", icon: Hourglass, count: folders.trial.filter((t) => !t.expired).length },
        { id: "subscription", label: "Abbonamenti", icon: CalendarClock, count: folders.subscription.length },
        { id: "lifetime", label: "A vita", icon: Crown, count: folders.lifetime.length },
        { id: "expired", label: "Scaduti", icon: RotateCcw, count: folders.expired.length },
        { id: "blocked", label: "Bloccati", icon: Ban, count: folders.blocked.length },
      ],
    },
    { id: "sales", label: "Vendite", icon: CircleDollarSign },
    {
      id: "codes",
      label: "Codici",
      icon: TicketPercent,
      children: [
        {
          id: "discount",
          label: "Sconto",
          icon: TicketPercent,
          count: codes.filter((code) => code.kind !== "gift" && codeState(code) === "active").length,
        },
        {
          id: "gift",
          label: "Regalo",
          icon: Gift,
          count: codes.filter((code) => code.kind === "gift" && codeState(code) === "active").length,
        },
        { id: "history", label: "Utilizzi", icon: History, count: promos.data?.redemptions.length ?? 0 },
      ],
    },
    {
      id: "support",
      label: "Assistenza",
      icon: Inbox,
      badge: ticketCount("new"),
      children: [
        { id: "new", label: "Nuove", icon: Inbox, count: ticketCount("new") },
        { id: "open", label: "In corso", icon: PlayCircle, count: ticketCount("open") },
        { id: "closed", label: "Chiuse", icon: CheckCircle2, count: ticketCount("closed") },
      ],
    },
    { id: "settings", label: "Sicurezza", icon: Settings },
  ];

  const activeFolder = (id: SectionId): string =>
    id === "customers" ? location.customers : id === "codes" ? location.codes : id === "support" ? location.support : "";

  const openFolder = (id: SectionId, folder: string): void => {
    if (id === "customers") go({ section: id, customers: folder as CustomerFolder });
    else if (id === "codes") go({ section: id, codes: folder as CodeFolder });
    else if (id === "support") go({ section: id, support: folder as TicketFolder });
  };

  const current = sections.find((section) => section.id === location.section) ?? sections[0];

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">NovaStream</div>
              <div className="text-[11px] text-muted-foreground">Area gestione</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={refreshAll} className="gap-1.5 text-muted-foreground">
              <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />
              <span className="hidden sm:inline">Aggiorna</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onSignOut} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Esci</span>
            </Button>
          </div>
        </div>

        {/* Phones and tablets: sections as a scrolling strip; folders live inside each page. */}
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2.5 lg:hidden">
          {sections.map((section) => {
            const active = section.id === location.section;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => go({ section: section.id })}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <section.icon className={cn("h-4 w-4", active && "text-primary")} />
                {section.label}
                {section.badge ? (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {section.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-6 lg:grid-cols-[232px_minmax(0,1fr)]">
        {/* Desktop: a folder tree, sub-folders open under the active section. */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {sections.map((section) => {
              const active = section.id === location.section;
              return (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() => go({ section: section.id })}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      active
                        ? "bg-primary/12 text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                    )}
                  >
                    <section.icon className={cn("h-4.5 w-4.5", active && "text-primary")} />
                    {section.label}
                    {section.badge ? (
                      <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {section.badge}
                      </span>
                    ) : null}
                  </button>
                  {active && section.children && (
                    <div className="ml-5 mt-1 space-y-0.5 border-l border-border/60 pl-3">
                      {section.children.map((child) => {
                        const open = activeFolder(section.id) === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => openFolder(section.id, child.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition",
                              open
                                ? "bg-secondary/70 font-medium text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <child.icon className="h-3.5 w-3.5" />
                            {child.label}
                            {child.count !== undefined && (
                              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{child.count}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <main key={location.section} className="animate-rise min-w-0 space-y-6">
          <SectionHeader
            icon={current.icon}
            title={current.label}
            subtitle={SUBTITLES[location.section]}
          />

          {location.section === "overview" && (
            <Overview
              licenses={licenses.data}
              tickets={tickets.data}
              promos={promos.data}
              onGo={goTarget}
              onGrant={() => setGranting(true)}
            />
          )}

          {location.section === "customers" && (
            <CustomersView
              token={token}
              data={licenses.data}
              loading={licenses.isLoading}
              folder={location.customers}
              onFolder={(folder) => go({ customers: folder })}
            />
          )}

          {location.section === "sales" && (
            <RevenuePanel
              orders={licenses.data?.orders ?? []}
              totalCents={licenses.data?.stats.revenueCents ?? 0}
              last30Cents={licenses.data?.stats.revenueCents30d ?? 0}
              loading={licenses.isLoading}
            />
          )}

          {location.section === "codes" && (
            <CodesView
              token={token}
              data={promos.data}
              loading={promos.isLoading}
              folder={location.codes}
              onFolder={(folder) => go({ codes: folder })}
            />
          )}

          {location.section === "support" && (
            <>
              <SubTabs
                items={(current.children ?? []).map((child) => ({ ...child, id: child.id as TicketFolder }))}
                value={location.support}
                onChange={(folder) => go({ support: folder })}
              />
              <SupportInbox token={token} folder={location.support} />
            </>
          )}

          {location.section === "settings" && <SecurityPanel token={token} />}
        </main>
      </div>

      <GrantDialog token={token} open={granting} onOpenChange={setGranting} />
    </div>
  );
}

const SUBTITLES: Record<SectionId, string> = {
  overview: "Il riepilogo di oggi: clienti, incassi, scadenze e richieste.",
  customers: "Ogni dispositivo diviso per cartella. Cerca, attiva, cambia la scadenza.",
  sales: "Incassi per mese e anno, con ogni acquisto e la prova di conferma.",
  codes: "Codici sconto per il pagamento e codici regalo che attivano una licenza gratis.",
  support: "Le richieste inviate dal modulo del sito.",
  settings: "Accesso all'area gestione e verifica in due passaggi.",
};

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

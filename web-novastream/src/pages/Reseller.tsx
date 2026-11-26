import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  Coins,
  Copy,
  Gift,
  History,
  Loader2,
  LockKeyhole,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  StickyNote,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyChip, EmptyState, Pill, RowButton, SubTabs } from "@/components/dashboard/ui";
import { errorText, useAdminAction } from "@/hooks/useAdminData";
import {
  ApiError,
  formatDate,
  formatDateTime,
  formatMac,
  isValidDeviceId,
  normalizeDeviceId,
  post,
  type LicenseRecord,
  type PromoCode,
  type PromoRedemption,
} from "@/lib/api";
import { codeValueLabel, copyText, giftLink, licenseState } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "novastream_reseller_token";
const USER_KEY = "novastream_reseller_user";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanCode = (raw: string): string => raw.replace(/\D/g, "").slice(0, 6);

type ResellerData = {
  ok: boolean;
  me: { id: string; username: string; credits: number; creditsSpent: number };
  licenses: LicenseRecord[];
  codes: PromoCode[];
  redemptions: PromoRedemption[];
};

export default function Reseller() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");

  useEffect(() => {
    document.title = "NovaStream · Pannello rivenditore";
  }, []);

  const signOut = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
  }, []);

  if (!token) {
    return (
      <LoginScreen
        onAuthenticated={(value) => {
          localStorage.setItem(TOKEN_KEY, value);
          setToken(value);
        }}
      />
    );
  }
  return <Panel token={token} onSignOut={signOut} />;
}

// ---- Login with mandatory two-factor ---------------------------------------

function LoginScreen({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [username, setUsername] = useState<string>(() => localStorage.getItem(USER_KEY) ?? "");
  const [password, setPassword] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [needsCode, setNeedsCode] = useState<boolean>(false);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [error, setError] = useState<string>("");

  const login = useMutation({
    mutationFn: () =>
      post<{ token?: string; username?: string; setup?: { secret: string; otpauth: string } }>("/api/reseller/login", {
        username: username.trim().toLowerCase(),
        password,
        code: code.trim(),
      }),
    onSuccess: (data) => {
      if (data.setup) {
        setSetup(data.setup);
        setNeedsCode(true);
        setCode("");
        return;
      }
      if (data.token) {
        localStorage.setItem(USER_KEY, username.trim().toLowerCase());
        onAuthenticated(data.token);
      }
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.twofaRequired) {
        setNeedsCode(true);
        setCode("");
        setError(
          err.message === "two-factor code required"
            ? "Inserisci il codice a 6 cifre della tua app di autenticazione."
            : "Codice non valido o già usato. Attendi il codice successivo.",
        );
        return;
      }
      if (err instanceof ApiError && err.status === 429) {
        setError(`Troppi tentativi falliti. Riprova tra ${Math.ceil(err.retryInSeconds / 60)} minuti.`);
        return;
      }
      setError(
        err instanceof Error && err.message === "wrong username or password"
          ? "Nome utente o password non corretti."
          : err instanceof Error
            ? errorText(err.message)
            : "Accesso non riuscito",
      );
    },
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
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
          {setup ? <ShieldCheck className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
        </div>
        <h1 className="mt-5 text-2xl font-bold">{setup ? "Attiva la verifica" : "Pannello rivenditore"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {setup
            ? "Primo accesso: inquadra il QR con Google Authenticator, Authy o un'app simile, poi scrivi il codice."
            : "Accedi con le credenziali ricevute da NovaStream."}
        </p>

        {setup ? (
          <div className="mt-6 space-y-3">
            <div className="mx-auto w-fit rounded-2xl bg-white p-3">
              <QRCodeSVG value={setup.otpauth} size={168} level="M" />
            </div>
            <div className="text-center text-xs text-muted-foreground">Oppure inserisci a mano la chiave:</div>
            <CopyChip
              value={setup.secret}
              toastLabel="Chiave copiata"
              className="mx-auto block w-fit rounded-lg bg-secondary/60 px-3 py-1.5 text-xs tracking-wider"
            />
          </div>
        ) : (
          <>
            <Label htmlFor="r-username" className="mt-7 block text-sm">
              Nome utente
            </Label>
            <Input
              id="r-username"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 h-12 border-border/80 bg-secondary/60"
            />
            <Label htmlFor="r-password" className="mt-4 block text-sm">
              Password
            </Label>
            <Input
              id="r-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 border-border/80 bg-secondary/60"
            />
          </>
        )}

        {needsCode && (
          <div className="animate-rise">
            <Label htmlFor="r-code" className="mt-4 block text-sm">
              Codice di verifica
            </Label>
            <Input
              id="r-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              autoFocus
              value={code}
              onChange={(event) => setCode(cleanCode(event.target.value))}
              className="mono mt-2 h-12 border-border/80 bg-secondary/60 text-center text-lg tracking-[0.4em]"
            />
          </div>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={login.isPending || !username.trim() || !password || (needsCode && code.length !== 6)}
          className="mt-6 h-12 w-full gap-2"
        >
          {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {setup ? "Attiva ed entra" : "Entra"}
        </Button>
        {setup && (
          <button
            type="button"
            onClick={() => {
              setSetup(null);
              setNeedsCode(false);
              setCode("");
              setError("");
            }}
            className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Indietro
          </button>
        )}
        <Link to="/" className="mt-5 block text-center text-xs text-muted-foreground transition hover:text-foreground">
          Torna al sito
        </Link>
      </form>
    </div>
  );
}

// ---- Panel -------------------------------------------------------------------

type Tab = "customers" | "codes" | "uses";

function Panel({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("customers");
  const data = useQuery({
    queryKey: ["reseller-me"],
    queryFn: () => post<ResellerData>("/api/reseller/me", {}, token),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (data.error instanceof Error && data.error.message === "unauthorized") onSignOut();
  }, [data.error, onSignOut]);

  const me = data.data?.me;
  const licenses = data.data?.licenses ?? [];
  const codes = data.data?.codes ?? [];
  const uses = data.data?.redemptions ?? [];
  const live = licenses.filter((row) => licenseState(row) === "active").length;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <div>
              <div className="text-sm font-bold leading-tight">NovaStream</div>
              <div className="text-[11px] text-muted-foreground">Rivenditore · {me?.username ?? "…"}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["reseller-me"] })}
              className="gap-1.5 text-muted-foreground"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", data.isFetching && "animate-spin")} />
              <span className="hidden sm:inline">Aggiorna</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onSignOut} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Esci</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="animate-rise relative mx-auto max-w-6xl space-y-6 px-5 py-6">
        {data.isLoading ? (
          <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carico il tuo pannello…
          </div>
        ) : data.error && !me ? (
          <div className="panel p-6 text-sm text-destructive">
            {data.error instanceof Error ? errorText(data.error.message) : "Errore"}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel relative overflow-hidden p-5">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl" aria-hidden />
                <Coins className="h-5 w-5 text-primary" />
                <div className="mt-3 text-4xl font-bold tabular-nums">{me?.credits ?? 0}</div>
                <div className="text-xs text-muted-foreground">crediti disponibili · 1 credito = 1 anno</div>
              </div>
              <div className="panel p-5">
                <Users className="h-5 w-5 text-accent" />
                <div className="mt-3 text-2xl font-bold tabular-nums">
                  {live}
                  <span className="text-base text-muted-foreground">/{licenses.length}</span>
                </div>
                <div className="text-xs text-muted-foreground">clienti attivi</div>
              </div>
              <div className="panel p-5">
                <Gift className="h-5 w-5 text-warning" />
                <div className="mt-3 text-2xl font-bold tabular-nums">
                  {codes.filter((code) => code.usedCount > 0).length}
                  <span className="text-base text-muted-foreground">/{codes.length}</span>
                </div>
                <div className="text-xs text-muted-foreground">codici usati · {me?.creditsSpent ?? 0} crediti spesi</div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ActivateCard token={token} credits={me?.credits ?? 0} />
              <CodesCard token={token} credits={me?.credits ?? 0} />
            </div>

            <SubTabs
              items={[
                { id: "customers" as const, label: "Clienti", icon: Users, count: licenses.length },
                { id: "codes" as const, label: "Codici", icon: Gift, count: codes.length },
                { id: "uses" as const, label: "Utilizzi", icon: History, count: uses.length },
              ]}
              value={tab}
              onChange={(value) => setTab(value as Tab)}
            />

            {tab === "customers" && <CustomerList token={token} rows={licenses} />}
            {tab === "codes" && <CodeList codes={codes} />}
            {tab === "uses" && <UseList token={token} rows={uses} />}
          </>
        )}
      </main>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof Zap; title: string; children: ReactNode }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center gap-2 font-semibold">
        <Icon className="h-4.5 w-4.5 text-primary" /> {title}
      </div>
      {children}
    </div>
  );
}

function YearsPicker({ value, onChange, credits }: { value: number; onChange: (value: number) => void; credits: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[1, 2, 3, 4, 5].map((years) => (
        <button
          key={years}
          type="button"
          onClick={() => onChange(years)}
          disabled={years > credits}
          className={cn(
            "rounded-xl border px-3 py-1.5 text-sm font-medium transition disabled:opacity-35",
            value === years ? "border-primary/60 bg-primary/15 text-foreground" : "border-border/70 text-muted-foreground",
          )}
        >
          {years} {years === 1 ? "anno" : "anni"}
        </button>
      ))}
    </div>
  );
}

function ActivateCard({ token, credits }: { token: string; credits: number }) {
  const [deviceId, setDeviceId] = useState<string>("");
  const [mac, setMac] = useState<string>("");
  const [years, setYears] = useState<number>(1);
  const [email, setEmail] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const activate = useAdminAction<{ ok: boolean; credits?: number; cost?: number }>(
    token,
    ["reseller-me"],
    (data) => `Licenza attivata · ${data.cost ?? years} crediti usati`,
  );

  const idValid = isValidDeviceId(deviceId);
  const emailOk = EMAIL_RE.test(email.trim());
  const problem = !deviceId
    ? ""
    : !idValid
      ? "ID dispositivo non valido."
      : email && !emailOk
        ? "Email non valida."
        : years > credits
          ? "Crediti insufficienti."
          : "";

  return (
    <Card icon={Zap} title="Attiva un dispositivo">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            placeholder="ID dispositivo (dall'app)"
            className="mono h-11 border-border/80 bg-secondary/60"
          />
          <Input
            value={mac}
            onChange={(event) => setMac(event.target.value)}
            placeholder="MAC (facoltativo)"
            className="mono h-11 border-border/80 bg-secondary/60"
          />
        </div>
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email del cliente (obbligatoria)"
          className={cn("h-11 border-border/80 bg-secondary/60", email && !emailOk && "border-destructive/70")}
        />
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Nota (solo per te)"
          className="h-11 border-border/80 bg-secondary/60"
        />
        <YearsPicker value={years} onChange={setYears} credits={credits} />
        {problem && <p className="text-xs text-warning">{problem}</p>}
        <Button
          className="h-11 w-full gap-2"
          disabled={!idValid || !emailOk || years > credits || activate.isPending}
          onClick={() =>
            activate.mutate(
              {
                path: "/api/reseller/activate",
                body: { deviceId: normalizeDeviceId(deviceId), mac: normalizeDeviceId(mac), years, email: email.trim(), note },
              },
              {
                onSuccess: () => {
                  setDeviceId("");
                  setMac("");
                  setEmail("");
                  setNote("");
                },
              },
            )
          }
        >
          {activate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Attiva {years} {years === 1 ? "anno" : "anni"} · {years} {years === 1 ? "credito" : "crediti"}
        </Button>
      </div>
    </Card>
  );
}

function CodesCard({ token, credits }: { token: string; credits: number }) {
  const [count, setCount] = useState<string>("1");
  const [years, setYears] = useState<number>(1);
  const [note, setNote] = useState<string>("");
  const [created, setCreated] = useState<string[]>([]);
  const create = useAdminAction<{ ok: boolean; codes?: string[]; cost?: number }>(
    token,
    ["reseller-me"],
    (data) => `${data.codes?.length ?? 0} codici creati · ${data.cost ?? 0} crediti usati`,
  );
  const countValue = Math.round(Number(count));
  const cost = countValue * years;
  const valid = countValue >= 1 && countValue <= 100 && cost <= credits;

  return (
    <Card icon={Gift} title="Crea codici regalo">
      {created.length > 0 ? (
        <div className="space-y-3">
          <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-secondary/40 p-3">
            {created.map((code) => (
              <div key={code} className="flex items-center justify-between gap-3">
                <CopyChip value={code} toastLabel="Codice copiato" className="text-sm font-bold tracking-wider" />
                <CopyChip value={giftLink(code)} display="link" toastLabel="Link copiato" className="text-xs text-muted-foreground" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 gap-2"
              onClick={() =>
                void copyText(created.join("\n")).then((ok) =>
                  ok ? toast.success("Codici copiati") : toast.error("Copia non riuscita"),
                )
              }
            >
              <Copy className="h-4 w-4" /> Copia tutti
            </Button>
            <Button className="flex-1" onClick={() => setCreated([])}>
              Fatto
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ogni codice attiva una licenza su un solo dispositivo. Il cliente lo inserisce sul sito con la sua email.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(event) => setCount(event.target.value)}
              className="h-11 w-24 border-border/80 bg-secondary/60"
            />
            <span className="text-sm text-muted-foreground">codici</span>
          </div>
          <YearsPicker value={years} onChange={setYears} credits={credits} />
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Nota (solo per te)"
            className="h-11 border-border/80 bg-secondary/60"
          />
          {cost > credits && <p className="text-xs text-warning">Crediti insufficienti: servono {cost}.</p>}
          <Button
            className="h-11 w-full gap-2"
            disabled={!valid || create.isPending}
            onClick={() =>
              create.mutate(
                { path: "/api/reseller/code-create", body: { count: countValue, years, note } },
                {
                  onSuccess: (data) => {
                    setCreated(data.codes ?? []);
                    setNote("");
                  },
                },
              )
            }
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crea · {Number.isFinite(cost) ? cost : 0} {cost === 1 ? "credito" : "crediti"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function CustomerList({ token, rows }: { token: string; rows: LicenseRecord[] }) {
  const [search, setSearch] = useState<string>("");
  const action = useAdminAction(token, ["reseller-me"], "Fatto");
  const filtered = useMemo(() => {
    const plain = search.trim().toLowerCase();
    const needle = normalizeDeviceId(search);
    return rows.filter(
      (row) =>
        !plain ||
        (needle && row.deviceId.includes(needle)) ||
        (needle && (row.aliases ?? []).some((alias) => alias.includes(needle))) ||
        row.email.toLowerCase().includes(plain) ||
        (row.resellerNote ?? "").toLowerCase().includes(plain),
    );
  }, [rows, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cerca MAC, email o nota"
          className="h-11 border-border/80 bg-secondary/60 pl-9"
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Users}>{search ? "Nessun risultato." : "Nessun cliente ancora. Attiva il primo dispositivo qui sopra."}</EmptyState>
      ) : (
        <div className="panel divide-y divide-border/50 overflow-hidden">
          {filtered.map((row) => {
            const state = licenseState(row);
            return (
              <div key={row.deviceId} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyChip value={row.deviceId} display={formatMac(row.deviceId)} className="text-sm font-semibold" />
                    <Pill
                      tone={state === "active" ? "accent" : state === "revoked" ? "destructive" : "warning"}
                      strong
                    >
                      {state === "active" ? "Attiva" : state === "expired" ? "Scaduta" : state === "revoked" ? "Revocata" : "Sospesa"}
                    </Pill>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {row.email && <span>{row.email}</span>}
                    <span>{row.expiresAt ? `scade il ${formatDate(row.expiresAt)}` : "a vita"}</span>
                    {(row.aliases ?? []).length > 0 && (
                      <span className="mono">anche {(row.aliases ?? []).map(formatMac).join(" · ")}</span>
                    )}
                  </div>
                  <NoteField
                    value={row.resellerNote ?? ""}
                    busy={action.isPending}
                    onSave={(note) => action.mutate({ path: "/api/reseller/note", body: { deviceId: row.deviceId, note } })}
                  />
                </div>
                {row.status === "active" ? (
                  <RowButton
                    icon={PauseCircle}
                    label="Revoca"
                    danger
                    disabled={action.isPending}
                    onClick={() => {
                      if (window.confirm(`Revocare la licenza di ${formatMac(row.deviceId)}? Il dispositivo smette di funzionare.`)) {
                        action.mutate({ path: "/api/reseller/license-status", body: { deviceId: row.deviceId, status: "revoked" } });
                      }
                    }}
                  />
                ) : (
                  <RowButton
                    icon={PlayCircle}
                    label="Ripristina"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ path: "/api/reseller/license-status", body: { deviceId: row.deviceId, status: "active" } })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Inline note: shows the text, edits in place, saves on Enter or the button. */
function NoteField({ value, busy, onSave }: { value: string; busy: boolean; onSave: (note: string) => void }) {
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>(value);

  useEffect(() => setDraft(value), [value]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg text-xs text-muted-foreground transition hover:text-foreground"
      >
        <StickyNote className="h-3.5 w-3.5" />
        {value ? <span className="text-foreground/85">{value}</span> : <span className="italic">Aggiungi una nota</span>}
      </button>
    );
  }
  return (
    <form
      className="mt-1.5 flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft.trim());
        setEditing(false);
      }}
    >
      <Input
        autoFocus
        value={draft}
        maxLength={200}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder="es. Marco, pagato in contanti"
        className="h-8 max-w-sm border-border/80 bg-secondary/60 text-xs"
      />
      <Button type="submit" size="sm" disabled={busy} className="h-8 text-xs">
        Salva
      </Button>
    </form>
  );
}

function CodeList({ codes }: { codes: PromoCode[] }) {
  if (codes.length === 0) return <EmptyState icon={Gift}>Nessun codice creato.</EmptyState>;
  return (
    <div className="panel divide-y divide-border/50 overflow-hidden">
      {codes.map((code) => {
        const used = code.maxUses > 0 && code.usedCount >= code.maxUses;
        return (
          <div key={code.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <CopyChip value={code.code} toastLabel="Codice copiato" className="text-sm font-bold tracking-wider" />
            <Pill tone="primary">{codeValueLabel(code)}</Pill>
            <Pill tone={used ? "muted" : code.active ? "accent" : "warning"} strong>
              {used ? "Usato" : code.active ? "Libero" : "Disattivato"}
            </Pill>
            {code.note && <span className="text-xs text-muted-foreground">{code.note}</span>}
            <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              {formatDate(code.createdAt)}
              <CopyChip value={giftLink(code.code)} display="link" toastLabel="Link copiato" />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function UseList({ token, rows }: { token: string; rows: PromoRedemption[] }) {
  const action = useAdminAction(token, ["reseller-me"], "");
  if (rows.length === 0) return <EmptyState icon={History}>Nessun codice usato finora.</EmptyState>;
  return (
    <div className="panel divide-y divide-border/50 overflow-hidden">
      {rows.map((row) => {
        const revoked = row.status === "revoked";
        return (
          <div
            key={row.id}
            className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-sm", revoked && "bg-destructive/5")}
          >
            <span className="w-36 shrink-0 text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>
            <span className={cn("mono font-semibold", revoked && "line-through opacity-60")}>{row.code}</span>
            {revoked && (
              <Pill tone="destructive" strong>
                Cancellata
              </Pill>
            )}
            <span className="mono text-xs text-muted-foreground">{formatMac(row.deviceId)}</span>
            {row.email && <span className="text-xs text-muted-foreground">{row.email}</span>}
            <span className="ml-auto">
              {revoked ? (
                <RowButton
                  icon={RotateCcw}
                  label="Ripristina"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate(
                      { path: "/api/reseller/redemption-restore", body: { id: row.id } },
                      { onSuccess: () => toast.success("Licenza ripristinata") },
                    )
                  }
                />
              ) : (
                <RowButton
                  icon={XCircle}
                  label="Cancella licenza"
                  danger
                  disabled={action.isPending}
                  onClick={() => {
                    if (window.confirm(`Cancellare la licenza attivata con ${row.code}? Il codice torna utilizzabile.`)) {
                      action.mutate(
                        { path: "/api/reseller/redemption-revoke", body: { id: row.id } },
                        { onSuccess: () => toast.success("Licenza cancellata") },
                      );
                    }
                  }}
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}


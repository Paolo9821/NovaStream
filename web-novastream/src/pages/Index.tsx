import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CreditCard,
  Infinity as InfinityIcon,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Tv,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmCheckout,
  fetchConfig,
  fetchDeviceStatus,
  formatDate,
  formatMac,
  isValidDeviceId,
  normalizeDeviceId,
  startCheckout,
  type CheckoutResult,
  type DeviceStatus,
  type PlanId,
  type PlanInfo,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const PLAN_COPY: Record<PlanId, { title: string; blurb: string; perks: string[] }> = {
  annual: {
    title: "12 mesi",
    blurb: "Un anno intero di visione, si rinnova quando vuoi tu.",
    perks: ["365 giorni di accesso", "Tutti gli aggiornamenti inclusi", "Rinnovabile con un clic"],
  },
  lifetime: {
    title: "A vita",
    blurb: "Paghi una volta sola e il dispositivo resta attivo per sempre.",
    perks: ["Nessuna scadenza", "Nessun rinnovo da ricordare", "Il miglior rapporto qualità/prezzo"],
  },
};

/** Reads the device id Stripe/the app may have put in the URL. */
function initialDeviceId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("device") ?? params.get("deviceId") ?? "";
}

export default function Index() {
  const [deviceId, setDeviceId] = useState<string>(initialDeviceId);
  const [email, setEmail] = useState<string>("");
  const [plan, setPlan] = useState<PlanId>("annual");
  const [purchase, setPurchase] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string>("");
  const [redirecting, setRedirecting] = useState<boolean>(false);
  const [returning, setReturning] = useState<boolean>(() =>
    new URLSearchParams(window.location.search).has("session_id"),
  );

  const config = useQuery({ queryKey: ["config"], queryFn: fetchConfig });

  const normalized = normalizeDeviceId(deviceId);
  const deviceValid = isValidDeviceId(deviceId);

  const plans: PlanInfo[] = useMemo(() => config.data?.plans ?? [], [config.data]);
  const selectedPlan = plans.find((p) => p.id === plan);

  // Stripe sends the buyer back with ?session_id=… — settle it and show the receipt.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("checkout") === "cancelled") {
      setError("Pagamento annullato. Nessun importo è stato addebitato.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!sessionId) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await confirmCheckout(sessionId);
        if (cancelled) return;
        if (result.ok) setPurchase(result);
        else setError(result.error ?? "Non siamo riusciti a confermare il pagamento.");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Verifica del pagamento non riuscita");
        }
      } finally {
        if (!cancelled) {
          setReturning(false);
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckout = useCallback(async (): Promise<void> => {
    setError("");
    setRedirecting(true);
    try {
      const session = await startCheckout(plan, normalizeDeviceId(deviceId), email.trim());
      window.location.assign(session.url);
    } catch (err) {
      setRedirecting(false);
      setError(err instanceof Error ? err.message : "Impossibile aprire il pagamento");
    }
  }, [deviceId, email, plan]);

  if (returning) {
    return <ConfirmingScreen />;
  }

  if (purchase?.ok) {
    return <SuccessScreen result={purchase} onReset={() => setPurchase(null)} />;
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />

      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary glow-ring">
            <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">NovaStream</span>
        </div>
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 rounded-full border border-border/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
        >
          <LockKeyhole className="h-3.5 w-3.5" />
          Gestione
        </Link>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 pb-24">
        <section className="animate-rise pt-8 text-center sm:pt-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            Attivazione automatica, 24 ore su 24
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Attiva NovaStream
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              in meno di un minuto
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground">
            Inserisci l&apos;identificativo del tuo dispositivo, paga con carta e riapri
            l&apos;app: sarà già sbloccata. Nessun codice da digitare, nessuna attesa.
          </p>
        </section>

        <section className="mt-14 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="panel animate-rise p-6 sm:p-7">
            <StepBadge index={1} label="Il tuo dispositivo" />
            <Label htmlFor="device" className="mt-5 block text-sm font-medium">
              Indirizzo MAC o ID dispositivo
            </Label>
            <Input
              id="device"
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              placeholder="A4:B1:C2:D3:E4:F5"
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "mono mt-2 h-13 border-border/80 bg-secondary/60 text-base tracking-wider uppercase placeholder:text-muted-foreground/50",
                deviceId.length > 0 && !deviceValid && "border-destructive/70",
              )}
            />
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
              Lo trovi nell&apos;app NovaStream in <strong className="text-foreground/80">Impostazioni → Licenza</strong>,
              oppure nella schermata che compare quando la prova gratuita finisce.
            </p>
            {deviceId.length > 0 && !deviceValid && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Controlla il codice: deve essere quello mostrato dall&apos;app.
              </p>
            )}
            {deviceValid && (
              <p className="mono mt-3 flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent">
                <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                {formatMac(normalized)}
              </p>
            )}

            <Label htmlFor="email" className="mt-7 block text-sm font-medium">
              Email <span className="font-normal text-muted-foreground">(facoltativa, per la ricevuta)</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@esempio.it"
              className="mt-2 h-12 border-border/80 bg-secondary/60"
            />

            <div className="mt-8 space-y-3">
              <StepBadge index={3} label="Pagamento" />
              {config.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carico il negozio…
                </div>
              )}
              {config.data && !config.data.paymentsConfigured && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground/90">
                  Il negozio non è ancora collegato a Stripe. Riprova tra poco.
                </div>
              )}
              {config.data?.paymentsConfigured && (
                <>
                  <Button
                    onClick={() => void handleCheckout()}
                    disabled={!deviceValid || redirecting}
                    className="h-13 w-full gap-2.5 text-base font-semibold"
                  >
                    {redirecting ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      <CreditCard className="h-4.5 w-4.5" />
                    )}
                    {redirecting
                      ? "Apro il pagamento sicuro…"
                      : selectedPlan
                        ? `Paga € ${selectedPlan.price.replace(".", ",")} con carta`
                        : "Paga con carta"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {deviceValid
                      ? "Verrai portato sulla pagina sicura di Stripe e poi riportato qui."
                      : "Inserisci prima l'identificativo del dispositivo."}
                  </p>
                  {config.data.mode === "test" && (
                    <p className="text-center text-[11px] uppercase tracking-widest text-warning/80">
                      Modalità test
                    </p>
                  )}
                </>
              )}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="animate-rise space-y-4">
            <StepBadge index={2} label="Scegli la formula" />
            {plans.map((info) => (
              <PlanCard
                key={info.id}
                info={info}
                selected={plan === info.id}
                onSelect={() => setPlan(info.id)}
              />
            ))}
            {selectedPlan && (
              <div className="panel flex items-center justify-between px-5 py-4">
                <span className="text-sm text-muted-foreground">Totale</span>
                <span className="text-2xl font-bold">€ {selectedPlan.price.replace(".", ",")}</span>
              </div>
            )}
            <div className="flex items-start gap-2.5 px-1 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              Il pagamento è gestito da Stripe: carta, Apple Pay e Google Pay. La licenza viene
              collegata solo al dispositivo che hai indicato e si attiva subito dopo il pagamento.
            </div>
          </div>
        </section>

        <HowItWorks />
        <StatusChecker />
      </main>

      <footer className="relative border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        NovaStream · Assistenza e licenze
      </footer>
    </div>
  );
}

function StepBadge({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="mono flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
        {index}
      </span>
      <span className="text-sm font-semibold uppercase tracking-wide text-foreground/80">{label}</span>
    </div>
  );
}

function PlanCard({
  info,
  selected,
  onSelect,
}: {
  info: PlanInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  const copy = PLAN_COPY[info.id];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "panel group relative w-full overflow-hidden p-5 text-left transition duration-300",
        selected
          ? "border-primary/60 bg-primary/[0.07] glow-ring"
          : "hover:border-border hover:bg-card/90",
      )}
    >
      {info.id === "lifetime" && (
        <span className="absolute right-4 top-4 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          Più scelto
        </span>
      )}
      <div className="flex items-center gap-2.5">
        {info.id === "lifetime" ? (
          <InfinityIcon className="h-4.5 w-4.5 text-accent" />
        ) : (
          <RefreshCw className="h-4 w-4 text-primary" />
        )}
        <h3 className="text-lg font-bold">{copy.title}</h3>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold tracking-tight">
          € {info.price.replace(".", ",")}
        </span>
        <span className="text-xs text-muted-foreground">
          {info.durationDays ? "/ anno" : "una tantum"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{copy.blurb}</p>
      <ul className="mt-4 space-y-1.5">
        {copy.perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2 text-xs text-foreground/75">
            <Check className={cn("h-3.5 w-3.5", selected ? "text-accent" : "text-muted-foreground")} />
            {perk}
          </li>
        ))}
      </ul>
    </button>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Smartphone,
      title: "Copia l'identificativo",
      body: "Apri NovaStream sul telefono o sulla TV e copia il codice mostrato in Impostazioni → Licenza.",
    },
    {
      icon: Zap,
      title: "Paga con carta",
      body: "Scegli 12 mesi o a vita e paga sulla pagina sicura di Stripe. L'attivazione è immediata.",
    },
    {
      icon: Tv,
      title: "Riapri l'app",
      body: "Chiudi e riapri NovaStream: si collega al server, riconosce il dispositivo e si sblocca.",
    },
  ];
  return (
    <section className="mt-20">
      <h2 className="text-center text-2xl font-bold sm:text-3xl">Come funziona</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="panel p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <step.icon className="h-5 w-5" />
            </div>
            <div className="mono mt-4 text-[11px] font-bold text-muted-foreground">
              0{index + 1}
            </div>
            <h3 className="mt-1 text-base font-bold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusChecker() {
  const [value, setValue] = useState<string>("");
  const [result, setResult] = useState<DeviceStatus | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [failed, setFailed] = useState<string>("");

  const check = async (): Promise<void> => {
    if (!isValidDeviceId(value)) {
      setFailed("Inserisci un identificativo valido.");
      return;
    }
    setBusy(true);
    setFailed("");
    try {
      setResult(await fetchDeviceStatus(normalizeDeviceId(value)));
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "Verifica non riuscita");
    } finally {
      setBusy(false);
    }
  };

  const message = ((): { text: string; tone: string } | null => {
    if (!result) return null;
    switch (result.status) {
      case "active":
        return {
          text: result.expiresAt
            ? `Licenza attiva fino al ${formatDate(result.expiresAt)}.`
            : "Licenza a vita attiva.",
          tone: "text-accent border-accent/30 bg-accent/10",
        };
      case "expired":
        return {
          text: `Licenza scaduta il ${formatDate(result.expiresAt)}. Rinnova qui sopra.`,
          tone: "text-warning border-warning/30 bg-warning/10",
        };
      case "suspended":
        return {
          text: "Licenza sospesa. Contatta l'assistenza.",
          tone: "text-warning border-warning/30 bg-warning/10",
        };
      case "revoked":
        return {
          text: "Licenza revocata.",
          tone: "text-destructive border-destructive/30 bg-destructive/10",
        };
      default:
        return {
          text: "Nessuna licenza per questo dispositivo. Puoi acquistarla qui sopra.",
          tone: "text-muted-foreground border-border bg-secondary/50",
        };
    }
  })();

  return (
    <section className="mt-20">
      <div className="panel mx-auto max-w-2xl p-6 sm:p-7">
        <h2 className="text-xl font-bold">Verifica una licenza</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Hai già pagato e vuoi controllare lo stato del tuo dispositivo?
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void check();
            }}
            placeholder="A4:B1:C2:D3:E4:F5"
            className="mono h-12 border-border/80 bg-secondary/60 uppercase tracking-wider"
          />
          <Button onClick={() => void check()} disabled={busy} className="h-12 gap-2 px-6 sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verifica
          </Button>
        </div>
        {failed && <p className="mt-3 text-sm text-destructive">{failed}</p>}
        {message && (
          <div className={cn("mt-4 rounded-xl border px-4 py-3 text-sm", message.tone)}>
            {message.text}
          </div>
        )}
      </div>
    </section>
  );
}

function ConfirmingScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-5">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />
      <div className="panel animate-rise relative w-full max-w-sm p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <h1 className="mt-5 text-xl font-bold">Confermo il pagamento…</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un istante: sto attivando la licenza sul tuo dispositivo.
        </p>
      </div>
    </div>
  );
}

function SuccessScreen({ result, onReset }: { result: CheckoutResult; onReset: () => void }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-16">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />
      <div className="panel animate-rise relative w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <BadgeCheck className="h-8 w-8" strokeWidth={2.2} />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold">Licenza attivata</h1>
        <p className="mt-3 text-balance leading-relaxed text-muted-foreground">
          Il pagamento è andato a buon fine. Chiudi completamente NovaStream e riaprila: sarà
          sbloccata su questo dispositivo.
        </p>
        <dl className="mt-7 space-y-2.5 rounded-xl border border-border/70 bg-secondary/40 px-5 py-4 text-left text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Dispositivo</dt>
            <dd className="mono text-xs">{formatMac(result.deviceId ?? "")}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Formula</dt>
            <dd className="font-medium">{result.plan === "lifetime" ? "A vita" : "12 mesi"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Valida fino al</dt>
            <dd className="font-medium">
              {result.expiresAt ? formatDate(result.expiresAt) : "Nessuna scadenza"}
            </dd>
          </div>
        </dl>
        <Button variant="secondary" onClick={onReset} className="mt-7 h-11 w-full">
          Attiva un altro dispositivo
        </Button>
      </div>
    </div>
  );
}

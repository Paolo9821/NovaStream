import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CreditCard,
  Gift,
  Infinity as InfinityIcon,
  TicketPercent,
  X,
  LifeBuoy,
  ListVideo,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Tv,
  Zap,
} from "lucide-react";

import { LanguagePicker, LanguageSection } from "@/components/LanguagePicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  checkPromo,
  confirmCheckout,
  fetchConfig,
  fetchDeviceStatus,
  formatDate,
  formatMac,
  isValidDeviceId,
  normalizeDeviceId,
  redeemPromo,
  startCheckout,
  type CheckoutResult,
  type DeviceStatus,
  type PlanId,
  type PlanInfo,
  type PromoQuote,
  type Term,
} from "@/lib/api";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Translation keys that describe each plan card. */
const PLAN_KEYS: Record<PlanId, { title: TranslationKey; blurb: TranslationKey; perks: TranslationKey[] }> = {
  annual: {
    title: "plan.annual.title",
    blurb: "plan.annual.blurb",
    perks: ["plan.annual.perk1", "plan.annual.perk2", "plan.annual.perk3"],
  },
  lifetime: {
    title: "plan.lifetime.title",
    blurb: "plan.lifetime.blurb",
    perks: ["plan.lifetime.perk1", "plan.lifetime.perk2", "plan.lifetime.perk3"],
  },
};

/** Play Store listing URL; override with VITE_PLAY_STORE_URL once the listing is live. */
const PLAY_STORE_URL: string =
  import.meta.env.VITE_PLAY_STORE_URL ??
  "https://play.google.com/store/apps/details?id=com.rork.novastream";

/** Official "Get it on Google Play" badge, localized per site language. */
const PLAY_BADGE_BY_LANG: Record<string, string> = {
  it: "/badges/it.png",
  en: "/badges/en.png",
  es: "/badges/es.png",
  fr: "/badges/fr.png",
  de: "/badges/de.png",
  pt: "/badges/pt.png",
  ro: "/badges/ro.png",
  tr: "/badges/tr.png",
};

/** Reads the device id Stripe/the app may have put in the URL. */
function initialDeviceId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("device") ?? params.get("deviceId") ?? "";
}

/** A gift link can carry its code: novastreamapp.com/?code=NOVA-ABCD-1234 */
function initialCode(): string {
  return new URLSearchParams(window.location.search).get("code")?.trim() ?? "";
}

type Translate = ReturnType<typeof useI18n>["t"];

const euros = (cents: number): string => `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;

/** "3 mesi", "licenza a vita"… for a duration object. */
function termText(t: Translate, term: Term | null): string {
  if (!term) return t("plan.annual.title");
  switch (term.kind) {
    case "lifetime":
      return t("promo.term.lifetime");
    case "months":
      return term.months === 1 ? t("promo.term.month") : t("promo.term.months", { n: String(term.months) });
    case "days":
      return term.days === 1 ? t("promo.term.day") : t("promo.term.days", { n: String(term.days) });
    case "date":
      return t("promo.term.date");
  }
}

/** Same, for the short code the server keeps on a licence ("3m", "30d", "lifetime"). */
function termCodeText(t: Translate, code: string): string {
  if (code === "lifetime") return termText(t, { kind: "lifetime" });
  if (code === "date") return termText(t, { kind: "date", expiresAt: 0 });
  const months = /^(\d+)m$/.exec(code);
  if (months) return termText(t, { kind: "months", months: Number(months[1]) });
  const days = /^(\d+)d$/.exec(code);
  if (days) return termText(t, { kind: "days", days: Number(days[1]) });
  return code;
}

/** Turns the server's reason into a sentence in the visitor's language. */
function promoErrorText(t: Translate, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const map: Record<string, TranslationKey> = {
    "code not found": "promo.err.notFound",
    "code required": "promo.err.notFound",
    "code expired": "promo.err.expired",
    "code used up": "promo.err.usedUp",
    "code disabled": "promo.err.disabled",
    "code not valid for this plan": "promo.err.plan",
    "too many attempts": "promo.err.tooMany",
    "already lifetime": "promo.err.lifetime",
    "already redeemed": "promo.err.already",
    "invalid device id": "promo.err.device",
  };
  if (error instanceof ApiError && error.status === 429) return t("promo.err.tooMany");
  return t(map[message] ?? "promo.err.generic");
}

export default function Index() {
  const { t, lang } = useI18n();
  const [deviceId, setDeviceId] = useState<string>(initialDeviceId);
  const [email, setEmail] = useState<string>("");
  const [plan, setPlan] = useState<PlanId>("annual");
  const [purchase, setPurchase] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string>("");
  const [redirecting, setRedirecting] = useState<boolean>(false);
  /** The buyer confirms they tried the app first; payment stays locked until then. */
  const [consented, setConsented] = useState<boolean>(false);
  const [consentAt, setConsentAt] = useState<number | null>(null);
  const [returning, setReturning] = useState<boolean>(() =>
    new URLSearchParams(window.location.search).has("session_id"),
  );
  const [promoOpen, setPromoOpen] = useState<boolean>(() => initialCode().length > 0);
  const [promoInput, setPromoInput] = useState<string>(initialCode);
  const [promo, setPromo] = useState<PromoQuote | null>(null);
  const [promoError, setPromoError] = useState<string>("");
  const [promoBusy, setPromoBusy] = useState<boolean>(false);
  const [redeeming, setRedeeming] = useState<boolean>(false);
  const [redeemedTerm, setRedeemedTerm] = useState<string>("");

  /** Free when it is a gift code or a 100% discount: no card, no Stripe. */
  const isFree = promo !== null && promo.finalCents === 0;
  const isGift = promo?.kind === "gift";

  const applyPromo = useCallback(
    async (raw: string, planId: PlanId): Promise<void> => {
      const code = raw.trim();
      if (!code) return;
      setPromoBusy(true);
      setPromoError("");
      try {
        const quote = await checkPromo(code, planId);
        setPromo(quote);
        if (quote.kind === "gift") setPlan(quote.plan);
      } catch (err) {
        setPromo(null);
        setPromoError(promoErrorText(t, err));
      } finally {
        setPromoBusy(false);
      }
    },
    [t],
  );

  const clearPromo = useCallback((): void => {
    setPromo(null);
    setPromoInput("");
    setPromoError("");
  }, []);

  // A discount depends on the plan: work it out again when the buyer switches.
  useEffect(() => {
    if (promo && promo.kind !== "gift" && promo.plan !== plan) void applyPromo(promo.code, plan);
  }, [plan, promo, applyPromo]);

  // Gift links arrive with ?code=…: apply it straight away.
  useEffect(() => {
    const code = initialCode();
    if (code) void applyPromo(code, "annual");
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRedeem = useCallback(async (): Promise<void> => {
    if (!promo) return;
    setError("");
    setRedeeming(true);
    try {
      const result = await redeemPromo(promo.code, plan, normalizeDeviceId(deviceId), email.trim());
      if (!result.ok) {
        setPromoError(promoErrorText(t, result.error));
        return;
      }
      setRedeemedTerm(result.term ?? "");
      setPurchase({
        ok: true,
        deviceId: result.deviceId,
        plan: result.plan === "lifetime" ? "lifetime" : "annual",
        expiresAt: result.expiresAt ?? null,
      });
    } catch (err) {
      setPromoError(promoErrorText(t, err));
    } finally {
      setRedeeming(false);
    }
  }, [deviceId, email, plan, promo, t]);

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
      setError(t("error.cancelled"));
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
        else setError(result.error ?? t("error.confirm"));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("error.confirmFailed"));
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
    // Runs once on mount: the payment return is a one-off event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckout = useCallback(async (): Promise<void> => {
    if (!consented) return;
    setError("");
    setRedirecting(true);
    try {
      const session = await startCheckout(
        plan,
        normalizeDeviceId(deviceId),
        email.trim(),
        {
          accepted: true,
          acceptedAt: consentAt ?? Date.now(),
          lang,
          text: t("consent.label"),
        },
        promo?.code,
      );
      window.location.assign(session.url);
    } catch (err) {
      setRedirecting(false);
      if (promo && err instanceof Error && err.message.startsWith("code")) {
        setPromo(null);
        setPromoError(promoErrorText(t, err));
        return;
      }
      setError(err instanceof Error ? err.message : t("error.open"));
    }
  }, [consentAt, consented, deviceId, email, lang, plan, promo, t]);

  const finalCents = promo && !isGift ? promo.finalCents : (selectedPlan?.priceCents ?? 0);

  if (returning) {
    return <ConfirmingScreen />;
  }

  if (purchase?.ok) {
    return (
      <SuccessScreen
        result={purchase}
        termLabel={redeemedTerm ? termCodeText(t, redeemedTerm) : ""}
        onReset={() => {
          setPurchase(null);
          setRedeemedTerm("");
          clearPromo();
        }}
      />
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />

      <header className="relative mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary glow-ring">
            <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">NovaStream</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguagePicker />
          <Link
            to="/playlist"
            className="flex items-center gap-1.5 rounded-full border border-border/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            <ListVideo className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("nav.playlists")}</span>
          </Link>
          <Link
            to="/assistenza"
            className="flex items-center gap-1.5 rounded-full border border-border/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("nav.support")}</span>
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 rounded-full border border-border/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            <LockKeyhole className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("nav.manage")}</span>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 pb-24">
        <section className="animate-rise pt-8 text-center sm:pt-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            {t("hero.badge")}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            {t("hero.titleA")}
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              {t("hero.titleB")}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground">
            {t("hero.sub")}
          </p>
          <PlayStoreBadge lang={lang} className="mt-8" />
        </section>

        <section className="mt-14 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="panel animate-rise p-6 sm:p-7">
            <StepBadge index={1} label={t("step.device")} />
            <Label htmlFor="device" className="mt-5 block text-sm font-medium">
              {t("device.label")}
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
              {t("device.helpBefore")}
              <strong className="text-foreground/80">{t("device.helpPath")}</strong>
              {t("device.helpAfter")}
            </p>
            {deviceId.length > 0 && !deviceValid && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("device.invalid")}
              </p>
            )}
            {deviceValid && (
              <p className="mono mt-3 flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent">
                <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                {formatMac(normalized)}
              </p>
            )}

            <Label htmlFor="email" className="mt-7 block text-sm font-medium">
              {t("email.label")}{" "}
              <span className="font-normal text-muted-foreground">{t("email.optional")}</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("email.placeholder")}
              className="mt-2 h-12 border-border/80 bg-secondary/60"
            />

            <div className="mt-8 space-y-3">
              <StepBadge index={3} label={t("step.payment")} />
              <PromoField
                open={promoOpen}
                onOpen={() => setPromoOpen(true)}
                value={promoInput}
                onChange={(value) => {
                  setPromoInput(value);
                  setPromoError("");
                }}
                busy={promoBusy}
                error={promoError}
                applied={promo}
                onApply={() => void applyPromo(promoInput, plan)}
                onRemove={clearPromo}
              />
              {isFree && (
                <>
                  <Button
                    onClick={() => void handleRedeem()}
                    disabled={!deviceValid || redeeming}
                    className="h-13 w-full gap-2.5 bg-accent text-base font-semibold text-accent-foreground hover:bg-accent/90"
                  >
                    {redeeming ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Gift className="h-4.5 w-4.5" />}
                    {redeeming ? t("promo.redeeming") : t("promo.redeem")}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {deviceValid ? t("promo.redeemHint") : t("promo.err.device")}
                  </p>
                </>
              )}
              {!isFree && config.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("pay.loading")}
                </div>
              )}
              {!isFree && config.data && !config.data.paymentsConfigured && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground/90">
                  {t("pay.notConfigured")}
                </div>
              )}
              {!isFree && config.data?.paymentsConfigured && (
                <>
                  <label
                    htmlFor="consent"
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition",
                      consented
                        ? "border-accent/40 bg-accent/[0.07]"
                        : "border-border/80 bg-secondary/40 hover:border-primary/40",
                    )}
                  >
                    <Checkbox
                      id="consent"
                      checked={consented}
                      onCheckedChange={(value) => {
                        const checked = value === true;
                        setConsented(checked);
                        setConsentAt(checked ? Date.now() : null);
                      }}
                      className="mt-0.5 h-5 w-5 shrink-0"
                    />
                    <span className="text-sm leading-relaxed text-foreground/85">
                      {t("consent.label")}{" "}
                      <Link
                        to="/termini"
                        target="_blank"
                        rel="noopener"
                        onClick={(event) => event.stopPropagation()}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {t("consent.terms")}
                      </Link>
                    </span>
                  </label>
                  <Button
                    onClick={() => void handleCheckout()}
                    disabled={!deviceValid || !consented || redirecting}
                    className="h-13 w-full gap-2.5 text-base font-semibold"
                  >
                    {redirecting ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      <CreditCard className="h-4.5 w-4.5" />
                    )}
                    {redirecting
                      ? t("pay.redirecting")
                      : selectedPlan
                        ? t("pay.button", { price: euros(finalCents) })
                        : t("pay.buttonGeneric")}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {!deviceValid
                      ? t("pay.hintNoDevice")
                      : consented
                        ? t("pay.hintReady")
                        : t("consent.required")}
                  </p>
                  {config.data.mode === "test" && (
                    <p className="text-center text-[11px] uppercase tracking-widest text-warning/80">
                      {t("pay.testMode")}
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
            <StepBadge index={2} label={t("step.plan")} />
            {isGift && promo ? (
              <GiftCard quote={promo} />
            ) : (
              plans.map((info) => (
                <PlanCard
                  key={info.id}
                  info={info}
                  selected={plan === info.id}
                  onSelect={() => setPlan(info.id)}
                />
              ))
            )}
            {selectedPlan && (
              <div className="panel px-5 py-4">
                {promo && !isGift && promo.discountCents > 0 && (
                  <div className="mb-3 space-y-1.5 border-b border-border/60 pb-3 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("promo.listPrice")}</span>
                      <span className="line-through">{euros(promo.listCents)}</span>
                    </div>
                    <div className="flex justify-between text-accent">
                      <span className="flex items-center gap-1.5">
                        <TicketPercent className="h-3.5 w-3.5" />
                        {t("promo.discount")} · <span className="mono text-xs">{promo.code}</span>
                      </span>
                      <span>− {euros(promo.discountCents)}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-sm text-muted-foreground">{t("total.label")}</span>
                    <span className="text-[11px] text-muted-foreground/80">{t("total.vat")}</span>
                  </div>
                  <span className="text-2xl font-bold">{euros(isFree ? 0 : finalCents)}</span>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2.5 px-1 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {t("trust")}
            </div>
          </div>
        </section>

        <HowItWorks />
        <PlaylistBanner />
        <StatusChecker />
        <HelpBanner />
        <LanguageSection />
      </main>

      <SiteFooter />
    </div>
  );
}

/** Collapsed "Have a code?" link that opens into a field; shows the applied code as a chip. */
function PromoField({
  open,
  onOpen,
  value,
  onChange,
  busy,
  error,
  applied,
  onApply,
  onRemove,
}: {
  open: boolean;
  onOpen: () => void;
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  error: string;
  applied: PromoQuote | null;
  onApply: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();

  if (applied) {
    const gift = applied.kind === "gift";
    return (
      <div className="animate-rise flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/[0.08] px-4 py-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          {gift ? <Gift className="h-4 w-4" /> : <TicketPercent className="h-4 w-4" />}
        </div>
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground/90">
          {gift
            ? t("promo.gift", { code: applied.code, term: termText(t, applied.term) })
            : t("promo.applied", { code: applied.code, amount: euros(applied.discountCents) })}
        </p>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("promo.remove")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 transition hover:underline"
      >
        <TicketPercent className="h-4 w-4" />
        {t("promo.toggle")}
      </button>
    );
  }

  return (
    <div className="animate-rise space-y-2">
      <Label htmlFor="promo" className="block text-sm font-medium">
        {t("promo.toggle")}
      </Label>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <Input
          id="promo"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("promo.placeholder")}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "mono h-12 border-border/80 bg-secondary/60 uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal",
            error && "border-destructive/70",
          )}
        />
        <Button type="submit" variant="secondary" disabled={busy || !value.trim()} className="h-12 shrink-0 px-5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("promo.apply")}
        </Button>
      </form>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Replaces the plan cards when a gift code decides the plan. */
function GiftCard({ quote }: { quote: PromoQuote }) {
  const { t } = useI18n();
  return (
    <div className="panel glow-ring relative overflow-hidden border-accent/50 bg-accent/[0.06] p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" aria-hidden />
      <div className="relative flex items-center gap-2.5">
        <Gift className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-bold">{t("promo.giftTitle")}</h3>
      </div>
      <div className="relative mt-3 text-3xl font-extrabold capitalize tracking-tight">{termText(t, quote.term)}</div>
      <p className="relative mt-1 text-sm text-muted-foreground">
        <span className="mono">{quote.code}</span>
      </p>
    </div>
  );
}

/** Official Google Play download badge for the Android app. */
export function PlayStoreBadge({ lang, className }: { lang: string; className?: string }) {
  const src = PLAY_BADGE_BY_LANG[lang] ?? "/badges/en.png";
  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Google Play"
      className={cn(
        "inline-block transition duration-300 hover:-translate-y-0.5 hover:drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)] active:translate-y-0",
        className,
      )}
    >
      <img
        src={src}
        alt="Google Play"
        width={172}
        height={67}
        loading="lazy"
        className="h-16 w-auto sm:h-[4.5rem]"
      />
    </a>
  );
}

/** Points customers at the website playlist manager. */
function PlaylistBanner() {
  const { t } = useI18n();
  return (
    <section className="mt-20">
      <div className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -left-16 -bottom-16 h-52 w-52 rounded-full bg-accent/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ListVideo className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t("pl.banner.title")}</h2>
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {t("pl.banner.body")}
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" className="h-12 shrink-0 gap-2 px-6 text-sm font-semibold">
            <Link to="/playlist">
              <ListVideo className="h-4 w-4" />
              {t("pl.banner.button")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Sends anyone with a problem to the contact form instead of a dead end. */
function HelpBanner() {
  const { t } = useI18n();
  return (
    <section className="mt-20">
      <div className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t("help.title")}</h2>
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {t("help.body")}
              </p>
            </div>
          </div>
          <Button asChild className="h-12 shrink-0 gap-2 px-6 text-sm font-semibold">
            <Link to="/assistenza">
              <LifeBuoy className="h-4 w-4" />
              {t("help.button")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const { t, lang } = useI18n();
  return (
    <footer className="relative border-t border-border/60 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <PlayStoreBadge lang={lang} className="h-11" />
        <span>{t("footer")}</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link to="/termini" className="transition hover:text-foreground">
            {t("legal.terms.title")}
          </Link>
          <Link to="/privacy" className="transition hover:text-foreground">
            {t("legal.privacy.title")}
          </Link>
          <Link to="/assistenza" className="transition hover:text-foreground">
            {t("footer.support")}
          </Link>
        </nav>
      </div>
    </footer>
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
  const { t } = useI18n();
  const copy = PLAN_KEYS[info.id];
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
          {t("plan.badge")}
        </span>
      )}
      <div className="flex items-center gap-2.5">
        {info.id === "lifetime" ? (
          <InfinityIcon className="h-4.5 w-4.5 text-accent" />
        ) : (
          <RefreshCw className="h-4 w-4 text-primary" />
        )}
        <h3 className="text-lg font-bold">{t(copy.title)}</h3>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold tracking-tight">
          € {info.price.replace(".", ",")}
        </span>
        <span className="text-xs text-muted-foreground">
          {info.durationDays ? t("plan.perYear") : t("plan.oneTime")}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{t(copy.blurb)}</p>
      <ul className="mt-4 space-y-1.5">
        {copy.perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2 text-xs text-foreground/75">
            <Check className={cn("h-3.5 w-3.5", selected ? "text-accent" : "text-muted-foreground")} />
            {t(perk)}
          </li>
        ))}
      </ul>
    </button>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { icon: Smartphone, title: t("how.s1.title"), body: t("how.s1.body") },
    { icon: Zap, title: t("how.s2.title"), body: t("how.s2.body") },
    { icon: Tv, title: t("how.s3.title"), body: t("how.s3.body") },
  ];
  return (
    <section className="mt-20">
      <h2 className="text-center text-2xl font-bold sm:text-3xl">{t("how.title")}</h2>
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
  const { t, locale } = useI18n();
  const [value, setValue] = useState<string>("");
  const [result, setResult] = useState<DeviceStatus | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [failed, setFailed] = useState<string>("");

  const check = async (): Promise<void> => {
    if (!isValidDeviceId(value)) {
      setFailed(t("check.invalid"));
      return;
    }
    setBusy(true);
    setFailed("");
    try {
      setResult(await fetchDeviceStatus(normalizeDeviceId(value)));
    } catch (error) {
      setFailed(error instanceof Error ? error.message : t("check.failed"));
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
            ? t("check.activeUntil", { date: formatDate(result.expiresAt, locale) })
            : t("check.activeLifetime"),
          tone: "text-accent border-accent/30 bg-accent/10",
        };
      case "expired":
        return {
          text: t("check.expired", { date: formatDate(result.expiresAt, locale) }),
          tone: "text-warning border-warning/30 bg-warning/10",
        };
      case "suspended":
        return {
          text: t("check.suspended"),
          tone: "text-warning border-warning/30 bg-warning/10",
        };
      case "revoked":
        return {
          text: t("check.revoked"),
          tone: "text-destructive border-destructive/30 bg-destructive/10",
        };
      default:
        return {
          text: t("check.none"),
          tone: "text-muted-foreground border-border bg-secondary/50",
        };
    }
  })();

  return (
    <section className="mt-20">
      <div className="panel mx-auto max-w-2xl p-6 sm:p-7">
        <h2 className="text-xl font-bold">{t("check.title")}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("check.sub")}</p>
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
            {t("check.button")}
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
  const { t } = useI18n();
  return (
    <div className="relative flex min-h-screen items-center justify-center px-5">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />
      <div className="panel animate-rise relative w-full max-w-sm p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <h1 className="mt-5 text-xl font-bold">{t("confirm.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("confirm.body")}</p>
      </div>
    </div>
  );
}

function SuccessScreen({
  result,
  termLabel,
  onReset,
}: {
  result: CheckoutResult;
  termLabel: string;
  onReset: () => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-16">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />
      <div className="panel animate-rise relative w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <BadgeCheck className="h-8 w-8" strokeWidth={2.2} />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold">{t("success.title")}</h1>
        <p className="mt-3 text-balance leading-relaxed text-muted-foreground">{t("success.body")}</p>
        <dl className="mt-7 space-y-2.5 rounded-xl border border-border/70 bg-secondary/40 px-5 py-4 text-left text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{t("success.device")}</dt>
            <dd className="mono text-xs">{formatMac(result.deviceId ?? "")}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{t("success.plan")}</dt>
            <dd className="font-medium capitalize">
              {termLabel || (result.plan === "lifetime" ? t("plan.lifetime.title") : t("plan.annual.title"))}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{t("success.until")}</dt>
            <dd className="font-medium">
              {result.expiresAt ? formatDate(result.expiresAt, locale) : t("success.noExpiry")}
            </dd>
          </div>
        </dl>
        <Button variant="secondary" onClick={onReset} className="mt-7 h-11 w-full">
          {t("success.another")}
        </Button>
      </div>
    </div>
  );
}

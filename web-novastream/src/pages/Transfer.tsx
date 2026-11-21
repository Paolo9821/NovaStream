import { useCallback, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  KeyRound,
  LifeBuoy,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tv,
  Zap,
} from "lucide-react";

import { LanguagePicker } from "@/components/LanguagePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFromApp } from "@/hooks/use-from-app";
import {
  ApiError,
  fetchCaptcha,
  formatDate,
  isValidDeviceId,
  normalizeDeviceId,
  transferLicense,
  type TransferDone,
} from "@/lib/api";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Method = "key" | "email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Maps registry/API error codes onto the localised copy. */
function errorKey(message: string): TranslationKey {
  if (message.startsWith("captcha")) return "pl.errCaptcha";
  switch (message) {
    case "invalid device id":
      return "tr.errIds";
    case "same device":
      return "tr.errSame";
    case "licence not found":
      return "tr.errNotFound";
    case "wrong old key":
      return "tr.errOldKey";
    case "wrong new key":
      return "tr.errNewKey";
    case "wrong email":
    case "invalid email":
      return "tr.errEmail";
    case "new device unknown":
      return "tr.errNewUnknown";
    case "new device has licence":
      return "tr.errNewHas";
    case "licence expired":
      return "tr.errExpired";
    case "licence revoked":
    case "licence suspended":
      return "tr.errBlocked";
    default:
      return "tr.errFailed";
  }
}

export default function Transfer() {
  const { t, locale } = useI18n();
  const fromApp = useFromApp();
  const [params] = useSearchParams();

  const [fromId, setFromId] = useState<string>(params.get("from") ?? "");
  const [toId, setToId] = useState<string>(params.get("device") ?? params.get("to") ?? "");
  const [method, setMethod] = useState<Method>("key");
  const [fromKey, setFromKey] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [toKey, setToKey] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [done, setDone] = useState<TransferDone | null>(null);

  const captcha = useQuery({
    queryKey: ["captcha", "transfer"],
    queryFn: fetchCaptcha,
    staleTime: 8 * 60 * 1000,
    refetchInterval: 9 * 60 * 1000,
  });

  const newCaptcha = useCallback((): void => {
    setAnswer("");
    void captcha.refetch();
  }, [captcha]);

  const send = useMutation({
    mutationFn: () =>
      transferLicense({
        fromId,
        toId,
        method,
        fromKey: method === "key" ? fromKey.replace(/\s/g, "") : "",
        email: method === "email" ? email.trim() : "",
        toKey: toKey.replace(/\s/g, ""),
        captchaToken: captcha.data?.token ?? "",
        captchaAnswer: answer,
      }),
    onSuccess: (result) => {
      setDone(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err: unknown) => {
      // Every challenge is good for one try, and the device keys are spent too.
      newCaptcha();
      setFromKey("");
      setToKey("");
      const message = err instanceof Error ? err.message : "";
      if (message === "transfer too soon" && err instanceof ApiError) {
        setError(t("tr.errSoon", { days: String(Math.max(1, Math.ceil(err.retryInSeconds / 86400))) }));
      } else if (err instanceof ApiError && err.retryInSeconds > 0) {
        setError(t("tr.errLocked", { min: String(Math.max(1, Math.ceil(err.retryInSeconds / 60))) }));
      } else {
        setError(t(errorKey(message)));
      }
    },
  });

  const submit = (): void => {
    setError("");
    if (!isValidDeviceId(normalizeDeviceId(fromId)) || !isValidDeviceId(normalizeDeviceId(toId))) {
      setError(t("tr.errIds"));
      return;
    }
    if (normalizeDeviceId(fromId) === normalizeDeviceId(toId)) {
      setError(t("tr.errSame"));
      return;
    }
    if (method === "email" && !EMAIL_RE.test(email.trim())) {
      setError(t("tr.errEmail"));
      return;
    }
    if (!answer.trim()) {
      setError(t("pl.errCaptchaEmpty"));
      return;
    }
    send.mutate();
  };

  const ready =
    fromId.trim().length > 0 &&
    toId.trim().length > 0 &&
    toKey.replace(/\s/g, "").length >= 4 &&
    (method === "key" ? fromKey.replace(/\s/g, "").length >= 4 : email.trim().length > 3) &&
    Boolean(captcha.data);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />

      <header className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-6">
        <Link to={fromApp ? "#" : "/"} className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">NovaStream</span>
        </Link>
        <LanguagePicker />
      </header>

      <main className="relative mx-auto max-w-3xl px-5 pb-24">
        {!fromApp && (
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("common.back")}
          </Link>
        )}

        <div className="animate-rise mt-6 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary glow-ring">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t("tr.title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("tr.sub")}</p>
          </div>
        </div>

        {done ? (
          <div className="panel animate-rise mt-7 p-7 text-center sm:p-9">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent glow-ring">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-2xl font-extrabold">{t("tr.doneTitle")}</h2>
            <div className="mono mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-2 text-sm">
              <span className="rounded-lg bg-secondary/70 px-2.5 py-1 text-muted-foreground line-through">{done.fromId}</span>
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              <span className="rounded-lg bg-primary/15 px-2.5 py-1 font-semibold text-primary">{done.toId}</span>
            </div>
            <p className="mt-3 text-sm font-semibold">
              {done.expiresAt ? t("tr.doneUntil", { date: formatDate(done.expiresAt, locale) }) : t("tr.doneLifetime")}
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{t("tr.doneBody")}</p>
            {!fromApp && (
              <Button asChild className="mt-7 h-12 px-6 font-semibold">
                <Link to="/">{t("tr.doneHome")}</Link>
              </Button>
            )}
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="mt-7"
          >
            <p className="animate-rise flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 text-xs leading-relaxed text-foreground/85">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {t("tr.note")}
            </p>

            {/* 1 · the device that holds the licence today */}
            <section className="panel animate-rise mt-5 p-6 sm:p-7">
              <StepTitle index={1} label={t("tr.oldTitle")} icon={<Tv className="h-4 w-4" />} />

              <Label htmlFor="tr-from" className="mt-5 block text-sm font-medium">
                {t("tr.oldId")}
              </Label>
              <Input
                id="tr-from"
                value={fromId}
                onChange={(event) => {
                  setFromId(event.target.value);
                  setError("");
                }}
                placeholder="A4:B1:C2:D3:E4:F5"
                autoComplete="off"
                spellCheck={false}
                className="mono mt-2 h-12 border-border/80 bg-secondary/60 uppercase tracking-wider"
              />

              <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-secondary/50 p-1" role="radiogroup">
                {(["key", "email"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={method === option}
                    onClick={() => {
                      setMethod(option);
                      setError("");
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:text-sm",
                      method === option
                        ? "bg-background text-foreground shadow-sm ring-1 ring-primary/40"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option === "key" ? <KeyRound className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    {option === "key" ? t("tr.methodKey") : t("tr.methodEmail")}
                  </button>
                ))}
              </div>

              {method === "key" ? (
                <>
                  <Label htmlFor="tr-from-key" className="mt-5 block text-sm font-medium">
                    {t("tr.oldKey")}
                  </Label>
                  <Input
                    id="tr-from-key"
                    value={fromKey}
                    onChange={(event) => {
                      setFromKey(event.target.value.toUpperCase());
                      setError("");
                    }}
                    placeholder="ABC 123"
                    maxLength={8}
                    autoComplete="off"
                    spellCheck={false}
                    className="mono mt-2 h-12 max-w-[220px] border-border/80 bg-secondary/60 text-lg uppercase tracking-[0.3em]"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("tr.keyHelp")}</p>
                </>
              ) : (
                <>
                  <Label htmlFor="tr-email" className="mt-5 block text-sm font-medium">
                    {t("tr.email")}
                  </Label>
                  <Input
                    id="tr-email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                    placeholder={t("email.placeholder")}
                    autoComplete="email"
                    className="mt-2 h-12 border-border/80 bg-secondary/60"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("tr.emailHelp")}</p>
                </>
              )}
            </section>

            <div className="flex justify-center py-2.5" aria-hidden>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <ArrowDown className="h-4 w-4" />
              </div>
            </div>

            {/* 2 · the device that will receive it */}
            <section className="panel animate-rise p-6 sm:p-7">
              <StepTitle index={2} label={t("tr.newTitle")} icon={<Smartphone className="h-4 w-4" />} />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("tr.newHelp")}</p>

              <Label htmlFor="tr-to" className="mt-5 block text-sm font-medium">
                {t("tr.newId")}
              </Label>
              <Input
                id="tr-to"
                value={toId}
                onChange={(event) => {
                  setToId(event.target.value);
                  setError("");
                }}
                placeholder="B8:27:EB:12:34:56"
                autoComplete="off"
                spellCheck={false}
                className="mono mt-2 h-12 border-border/80 bg-secondary/60 uppercase tracking-wider"
              />

              <Label htmlFor="tr-to-key" className="mt-5 block text-sm font-medium">
                {t("tr.newKey")}
              </Label>
              <Input
                id="tr-to-key"
                value={toKey}
                onChange={(event) => {
                  setToKey(event.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="XYZ 789"
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                className="mono mt-2 h-12 max-w-[220px] border-border/80 bg-secondary/60 text-lg uppercase tracking-[0.3em]"
              />
            </section>

            {/* 3 · bot check and confirm */}
            <section className="panel animate-rise mt-5 p-6 sm:p-7">
              <StepTitle index={3} label={t("tr.confirmTitle")} icon={<ShieldCheck className="h-4 w-4" />} />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("pl.captchaHelp")}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <div className="flex h-[84px] w-[260px] items-center justify-center overflow-hidden rounded-[14px] border border-border/70 bg-[#0B1220]">
                    {captcha.data ? (
                      <img
                        src={captcha.data.image}
                        alt={t("pl.captcha")}
                        width={260}
                        height={84}
                        draggable={false}
                        className="select-none"
                      />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={newCaptcha}
                    disabled={captcha.isFetching}
                    aria-label={t("pl.captchaRefresh")}
                    title={t("pl.captchaRefresh")}
                    className="h-11 w-11 shrink-0"
                  >
                    <RefreshCw className={cn("h-4 w-4", captcha.isFetching && "animate-spin")} />
                  </Button>
                </div>
                <Input
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
                    setError("");
                  }}
                  placeholder={t("pl.captchaPlaceholder")}
                  aria-label={t("pl.captchaPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  className="mono h-12 flex-1 border-border/80 bg-background/60 text-lg uppercase tracking-[0.3em]"
                />
              </div>

              {error && <ErrorBox message={error} />}

              <Button
                type="submit"
                disabled={send.isPending || !ready}
                className="mt-6 h-13 w-full gap-2.5 text-base font-semibold"
              >
                {send.isPending ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-4.5 w-4.5" />
                )}
                {send.isPending ? t("tr.sending") : t("tr.submit")}
              </Button>
            </section>
          </form>
        )}

        <Link
          to="/assistenza"
          className="mt-5 flex items-start gap-2.5 px-1 text-xs leading-relaxed text-muted-foreground transition hover:text-foreground"
        >
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          {t("tr.help")}
        </Link>
      </main>
    </div>
  );
}

function StepTitle({ index, label, icon }: { index: number; label: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="mono flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
        {index}
      </span>
      <span className="text-sm font-semibold uppercase tracking-wide text-foreground/80">{label}</span>
      <span className="ml-auto text-muted-foreground">{icon}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span>{message}</span>
    </div>
  );
}

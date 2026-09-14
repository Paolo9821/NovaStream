import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  HelpCircle,
  LifeBuoy,
  Loader2,
  Send,
  Smartphone,
  Trash2,
  TvMinimalPlay,
  Zap,
} from "lucide-react";

import { LanguagePicker } from "@/components/LanguagePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, normalizeDeviceId, submitTicket } from "@/lib/api";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Topic = "subscription" | "payment" | "activation" | "other" | "deletion";

const TOPICS: { id: Topic; label: TranslationKey; icon: typeof LifeBuoy }[] = [
  { id: "subscription", label: "support.topic.subscription", icon: TvMinimalPlay },
  { id: "payment", label: "support.topic.payment", icon: CreditCard },
  { id: "activation", label: "support.topic.activation", icon: Smartphone },
  { id: "other", label: "support.topic.other", icon: HelpCircle },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The store may hand the visitor over with their device already known. */
function initialDeviceId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("device") ?? params.get("deviceId") ?? "";
}

export default function Support() {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>(initialDeviceId);
  const [topic, setTopic] = useState<Topic>("subscription");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  /** The form switches to the erasure request, which needs its own consent. */
  const [deletionMode, setDeletionMode] = useState<boolean>(false);
  const [deletionConfirmed, setDeletionConfirmed] = useState<boolean>(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const send = useMutation({
    mutationFn: () =>
      submitTicket({
        email: email.trim(),
        deviceId: normalizeDeviceId(deviceId),
        topic: deletionMode ? "deletion" : topic,
        // The consent line travels with the request, so the erasure is
        // documented rather than inferred from a topic label.
        message: deletionMode
          ? `[DATA DELETION REQUEST]\n${t("support.deletion.confirm")}\n\n${message.trim()}`
          : message.trim(),
        lang,
      }),
    onSuccess: (data) => setReference(data.id),
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 429) {
        setError(t("support.tooMany"));
        return;
      }
      setError(t("support.failed"));
    },
  });

  const submit = useCallback((): void => {
    setError("");
    if (!EMAIL_RE.test(email.trim())) {
      setError(t("support.errEmail"));
      return;
    }
    if (deletionMode) {
      // An erasure cannot be undone, so it only leaves with an explicit tick.
      if (!deletionConfirmed) {
        setError(t("support.deletion.errConfirm"));
        return;
      }
      send.mutate();
      return;
    }
    if (message.trim().length < 10) {
      setError(t("support.errMessage"));
      return;
    }
    send.mutate();
  }, [deletionConfirmed, deletionMode, email, message, send, t]);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />

      <header className="relative mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">NovaStream</span>
        </Link>
        <LanguagePicker />
      </header>

      <main className="relative mx-auto max-w-2xl px-5 pb-24">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Link>

        {reference ? (
          <div className="panel animate-rise mt-6 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <BadgeCheck className="h-8 w-8" strokeWidth={2.2} />
            </div>
            <h1 className="mt-6 text-2xl font-extrabold">
              {deletionMode ? t("support.deletion.doneTitle") : t("support.done.title")}
            </h1>
            <p className="mt-3 text-balance text-sm leading-relaxed text-muted-foreground">
              {deletionMode ? t("support.deletion.doneBody") : t("support.done.body")}
            </p>
            <p className="mono mt-5 inline-flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              {t("support.done.ref")}: {reference}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setReference("");
                setMessage("");
                setDeletionMode(false);
                setDeletionConfirmed(false);
                send.reset();
              }}
              className="mt-7 h-11 w-full"
            >
              {deletionMode ? t("support.deletion.back") : t("support.done.again")}
            </Button>
          </div>
        ) : (
          <>
            <div className="animate-rise mt-6 flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary glow-ring">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
                  {deletionMode ? t("support.deletion.title") : t("support.title")}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {deletionMode ? t("support.deletion.body") : t("support.sub")}
                </p>
              </div>
            </div>

            <p
              className={cn(
                "mt-5 rounded-xl border px-4 py-3 text-xs leading-relaxed",
                deletionMode
                  ? "border-destructive/40 bg-destructive/[0.08] text-foreground/90"
                  : "border-warning/25 bg-warning/[0.07] text-foreground/80",
              )}
            >
              {deletionMode ? t("support.deletion.warning") : t("support.note")}
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
              className="panel animate-rise mt-5 p-6 sm:p-7"
            >
              <Label htmlFor="support-email" className="block text-sm font-medium">
                {t("support.email")}
              </Label>
              <Input
                id="support-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@esempio.it"
                className="mt-2 h-12 border-border/80 bg-secondary/60"
              />
              <p className="mt-2 text-xs text-muted-foreground">{t("support.emailHelp")}</p>

              <Label htmlFor="support-device" className="mt-6 block text-sm font-medium">
                {t("support.device")}
              </Label>
              <Input
                id="support-device"
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                placeholder="A4:B1:C2:D3:E4:F5"
                spellCheck={false}
                className="mono mt-2 h-12 border-border/80 bg-secondary/60 uppercase tracking-wider"
              />
              <p className="mt-2 text-xs text-muted-foreground">{t("support.deviceHelp")}</p>

              {!deletionMode && (
                <>
                  <span className="mt-6 block text-sm font-medium">{t("support.topic")}</span>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {TOPICS.map((entry) => {
                      const active = entry.id === topic;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setTopic(entry.id)}
                          aria-pressed={active}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm transition duration-300",
                            active
                              ? "border-primary/60 bg-primary/[0.09] text-foreground glow-ring"
                              : "border-border/70 bg-secondary/40 text-muted-foreground hover:border-border hover:text-foreground",
                          )}
                        >
                          <entry.icon
                            className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                          />
                          {t(entry.label)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <Label htmlFor="support-message" className="mt-6 block text-sm font-medium">
                {t("support.message")}
              </Label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={
                  deletionMode
                    ? t("support.deletion.messagePlaceholder")
                    : t("support.messagePlaceholder")
                }
                rows={deletionMode ? 4 : 6}
                maxLength={4000}
                className="mt-2 resize-y border-border/80 bg-secondary/60 text-sm leading-relaxed"
              />

              {deletionMode && (
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/[0.06] px-4 py-3.5 text-sm leading-relaxed">
                  <input
                    type="checkbox"
                    checked={deletionConfirmed}
                    onChange={(event) => {
                      setDeletionConfirmed(event.target.checked);
                      setError("");
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
                  />
                  <span>{t("support.deletion.confirm")}</span>
                </label>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={send.isPending}
                variant={deletionMode ? "destructive" : "default"}
                className="mt-6 h-13 w-full gap-2.5 text-base font-semibold"
              >
                {send.isPending ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : deletionMode ? (
                  <Trash2 className="h-4.5 w-4.5" />
                ) : (
                  <Send className="h-4.5 w-4.5" />
                )}
                {send.isPending
                  ? t("support.sending")
                  : deletionMode
                    ? t("support.deletion.send")
                    : t("support.send")}
              </Button>
            </form>

            {/*
              The erasure request lives below the ordinary form rather than as
              one more topic: it is the one action here that cannot be undone,
              so it gets its own panel, its own warning and its own consent.
            */}
            <div className="panel animate-rise mt-5 border-destructive/30 p-6 sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/12 text-destructive">
                  <Trash2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{t("support.deletion.title")}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t("support.deletion.body")}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant={deletionMode ? "secondary" : "outline"}
                onClick={() => {
                  setDeletionMode((current) => !current);
                  setDeletionConfirmed(false);
                  setError("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="mt-5 h-11 w-full"
              >
                {deletionMode ? t("support.deletion.back") : t("support.deletion.cta")}
              </Button>
            </div>
          </>
        )}

        <nav className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <Link to="/termini" className="transition hover:text-foreground">
            {t("legal.terms.title")}
          </Link>
          <Link to="/privacy" className="transition hover:text-foreground">
            {t("legal.privacy.title")}
          </Link>
        </nav>
      </main>
    </div>
  );
}

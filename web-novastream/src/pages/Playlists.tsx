import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Clock,
  KeyRound,
  Link2,
  ListVideo,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Smartphone,
  Trash2,
  Tv,
  Zap,
} from "lucide-react";

import { LanguagePicker } from "@/components/LanguagePicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  addDevicePlaylist,
  fetchCaptcha,
  formatDateTime,
  formatMac,
  isValidDeviceId,
  openDevice,
  removeDevicePlaylist,
  type DevicePlaylist,
  type NewPlaylist,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Session = { identifier: string; key: string };

const SESSION_KEY = "novastream_playlist_device";

const EMPTY_FORM: NewPlaylist = {
  name: "",
  type: "m3u",
  m3uUrl: "",
  server: "",
  username: "",
  password: "",
  epgUrl: "",
};

const isHttpUrl = (value: string): boolean => /^https?:\/\/\S+\.\S+/i.test(value.trim());

/** The app's QR code opens this page with the device and key already filled in. */
function initialSession(): { identifier: string; key: string; auto: boolean } {
  const params = new URLSearchParams(window.location.search);
  const identifier = params.get("device") ?? "";
  const key = params.get("key") ?? "";
  if (identifier && key) return { identifier, key, auto: true };
  try {
    // Kept for this browser tab only, so a refresh does not log the visitor out.
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    if (saved?.identifier && saved.key) return { ...saved, auto: true };
  } catch {
    /* nothing saved */
  }
  return { identifier, key, auto: false };
}

export default function Playlists() {
  const { t } = useI18n();
  const [start] = useState(initialSession);
  const [identifier, setIdentifier] = useState<string>(start.identifier);
  const [key, setKey] = useState<string>(start.key);
  const [session, setSession] = useState<Session | null>(null);
  const [openError, setOpenError] = useState<string>("");

  useEffect(() => {
    window.scrollTo(0, 0);
    // The key must not linger in the address bar or in the browser history.
    if (window.location.search) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const open = useMutation({
    mutationFn: (input: Session) => openDevice(input.identifier, input.key),
    onSuccess: (_data, input) => {
      setSession(input);
      setOpenError("");
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(input));
    },
    onError: (err: unknown) => {
      sessionStorage.removeItem(SESSION_KEY);
      if (err instanceof ApiError && err.retryInSeconds > 0) {
        setOpenError(t("pl.errLocked", { min: String(Math.ceil(err.retryInSeconds / 60)) }));
      } else if (err instanceof ApiError && (err.status === 403 || err.status === 400)) {
        setOpenError(t("pl.errOpen"));
      } else {
        setOpenError(t("pl.errGeneric"));
      }
    },
  });

  const submitOpen = useCallback((): void => {
    if (!isValidDeviceId(identifier)) {
      setOpenError(t("pl.errInvalid"));
      return;
    }
    open.mutate({ identifier, key: key.trim().toUpperCase() });
  }, [identifier, key, open, t]);

  useEffect(() => {
    if (start.auto && isValidDeviceId(start.identifier)) {
      open.mutate({ identifier: start.identifier, key: start.key.trim().toUpperCase() });
    }
    // One automatic attempt, only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = (): void => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setKey("");
    open.reset();
  };

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />

      <header className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">NovaStream</span>
        </Link>
        <LanguagePicker />
      </header>

      <main className="relative mx-auto max-w-3xl px-5 pb-24">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Link>

        <div className="animate-rise mt-6 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary glow-ring">
            <ListVideo className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t("pl.title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("pl.sub")}</p>
          </div>
        </div>

        {session ? (
          <DeviceManager session={session} onLogout={logout} />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitOpen();
            }}
            className="panel animate-rise mt-7 p-6 sm:p-7"
          >
            <StepTitle index={1} label={t("pl.step.open")} />
            <Label htmlFor="pl-device" className="mt-5 block text-sm font-medium">
              {t("pl.device")}
            </Label>
            <Input
              id="pl-device"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="A4:B1:C2:D3:E4:F5"
              autoComplete="off"
              spellCheck={false}
              className="mono mt-2 h-12 border-border/80 bg-secondary/60 uppercase tracking-wider"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("pl.deviceHelp")}</p>

            <Label htmlFor="pl-key" className="mt-6 block text-sm font-medium">
              {t("pl.key")}
            </Label>
            <Input
              id="pl-key"
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              placeholder="ABC 123"
              maxLength={8}
              autoComplete="off"
              spellCheck={false}
              className="mono mt-2 h-12 max-w-[220px] border-border/80 bg-secondary/60 text-lg uppercase tracking-[0.3em]"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("pl.keyHelp")}</p>

            {openError && <ErrorBox message={openError} />}

            <Button
              type="submit"
              disabled={open.isPending || !identifier.trim() || key.trim().length < 4}
              className="mt-6 h-12 w-full gap-2 text-base font-semibold"
            >
              {open.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <KeyRound className="h-4.5 w-4.5" />}
              {open.isPending ? t("pl.opening") : t("pl.open")}
            </Button>
          </form>
        )}

        <p className="mt-5 flex items-start gap-2.5 px-1 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          {t("pl.privacy")}
        </p>
      </main>
    </div>
  );
}

function DeviceManager({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { t, locale } = useI18n();
  const [pendingDelete, setPendingDelete] = useState<DevicePlaylist | null>(null);
  const [notice, setNotice] = useState<string>("");

  const device = useQuery({
    queryKey: ["device-playlists", session.identifier, session.key],
    queryFn: () => openDevice(session.identifier, session.key),
    // The device confirms installs and removals by itself: keep the list fresh.
    refetchInterval: 15_000,
  });

  const playlists: DevicePlaylist[] = device.data?.playlists ?? [];
  const full = device.data ? playlists.length >= device.data.limit : false;

  const remove = useMutation({
    mutationFn: (item: DevicePlaylist) => removeDevicePlaylist(session.identifier, session.key, item.id),
    onSuccess: () => {
      setNotice(t("pl.deleted"));
      void device.refetch();
    },
    onError: () => setNotice(t("pl.errGeneric")),
  });

  return (
    <>
      <section className="panel animate-rise mt-7 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <StepTitle index={2} label={t("pl.step.list")} />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void device.refetch()}
              disabled={device.isFetching}
              className="h-9 gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", device.isFetching && "animate-spin")} />
              {t("pl.refresh")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout} className="h-9 gap-1.5 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              {t("pl.switch")}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-xs">
          <span className="mono flex items-center gap-2 text-foreground/90">
            <Tv className="h-3.5 w-3.5 text-primary" />
            {formatMac(session.identifier)}
          </span>
          {device.data && (
            <span className="text-muted-foreground">
              {t("pl.lastSeen", { date: formatDateTime(device.data.lastSeenAt, locale) })}
            </span>
          )}
        </div>

        {notice && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-foreground/90">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            {notice}
          </p>
        )}

        <div className="mt-4 space-y-2.5">
          {device.isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {device.isError && <ErrorBox message={t("pl.errGeneric")} />}
          {device.data && playlists.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
              {t("pl.empty")}
            </div>
          )}
          {playlists.map((item) => (
            <PlaylistRow key={item.id} item={item} onDelete={() => setPendingDelete(item)} />
          ))}
        </div>
      </section>

      <AddPlaylistForm
        session={session}
        disabled={full}
        onAdded={(message) => {
          setNotice(message);
          void device.refetch();
        }}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(value) => !value && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pl.deleteTitle", { name: pendingDelete?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("pl.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("pl.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              {t("pl.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PlaylistRow({ item, onDelete }: { item: DevicePlaylist; onDelete: () => void }) {
  const { t } = useI18n();
  const tone =
    item.status === "installed"
      ? "border-accent/30 bg-accent/10 text-accent"
      : item.status === "deleting"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-warning/30 bg-warning/10 text-warning";
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-xl border border-border/70 bg-card/60 px-4 py-3.5 transition",
        item.status === "deleting" && "opacity-60",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
        {item.type === "xtream" ? <Server className="h-4.5 w-4.5" /> : <Link2 className="h-4.5 w-4.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{item.name}</span>
          <span className="mono rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
            {item.type === "xtream" ? "Xtream" : "M3U"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {item.host && <span className="mono truncate">{item.host}</span>}
          <span className="flex items-center gap-1">
            {item.origin === "app" ? <Smartphone className="h-3 w-3" /> : <Send className="h-3 w-3" />}
            {item.origin === "app" ? t("pl.origin.app") : t("pl.origin.web")}
          </span>
        </div>
      </div>
      <span className={cn("hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:flex", tone)}>
        {item.status === "pending" && <Clock className="h-3 w-3" />}
        {item.status === "installed" && <BadgeCheck className="h-3 w-3" />}
        {item.status === "deleting" && <Loader2 className="h-3 w-3 animate-spin" />}
        {t(`pl.status.${item.status}`)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={item.status === "deleting"}
        aria-label={t("pl.delete")}
        className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AddPlaylistForm({
  session,
  disabled,
  onAdded,
}: {
  session: Session;
  disabled: boolean;
  onAdded: (message: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<NewPlaylist>(EMPTY_FORM);
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string>("");

  const captcha = useQuery({
    queryKey: ["captcha"],
    queryFn: fetchCaptcha,
    staleTime: 8 * 60 * 1000,
    refetchInterval: 9 * 60 * 1000,
  });

  const newCaptcha = useCallback((): void => {
    setAnswer("");
    void captcha.refetch();
  }, [captcha]);

  const update = <K extends keyof NewPlaylist>(field: K, value: NewPlaylist[K]): void => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const send = useMutation({
    mutationFn: () =>
      addDevicePlaylist({
        identifier: session.identifier,
        key: session.key,
        playlist: { ...form, name: form.name.trim() },
        captchaToken: captcha.data?.token ?? "",
        captchaAnswer: answer,
      }),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      newCaptcha();
      onAdded(t("pl.added"));
    },
    onError: (err: unknown) => {
      // Every challenge is good for one try: a new one is ready either way.
      newCaptcha();
      const message = err instanceof Error ? err.message : "";
      if (message.startsWith("captcha")) setError(t("pl.errCaptcha"));
      else if (message === "too many playlists") setError(t("pl.errLimit"));
      else if (message === "invalid m3u url") setError(t("pl.errM3u"));
      else if (message === "invalid server") setError(t("pl.errServer"));
      else if (message === "missing credentials") setError(t("pl.errCreds"));
      else if (message === "invalid epg url") setError(t("pl.errEpg"));
      else if (err instanceof ApiError && err.retryInSeconds > 0) {
        setError(t("pl.errLocked", { min: String(Math.ceil(err.retryInSeconds / 60)) }));
      } else setError(t("pl.errGeneric"));
    },
  });

  const submit = (): void => {
    setError("");
    if (form.type === "m3u" && !isHttpUrl(form.m3uUrl)) return setError(t("pl.errM3u"));
    if (form.type === "xtream") {
      if (!isHttpUrl(form.server)) return setError(t("pl.errServer"));
      if (!form.username.trim() || !form.password) return setError(t("pl.errCreds"));
    }
    if (form.epgUrl.trim() && !isHttpUrl(form.epgUrl)) return setError(t("pl.errEpg"));
    if (answer.trim().length < 4) return setError(t("pl.errCaptchaEmpty"));
    send.mutate();
  };

  const types: { id: NewPlaylist["type"]; title: string; hint: string; icon: typeof Link2 }[] = [
    { id: "m3u", title: t("pl.typeM3u"), hint: t("pl.typeM3uHint"), icon: Link2 },
    { id: "xtream", title: t("pl.typeXtream"), hint: t("pl.typeXtreamHint"), icon: Server },
  ];

  const fieldClass = "mt-2 h-12 border-border/80 bg-secondary/60";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn("panel animate-rise mt-5 p-6 sm:p-7", disabled && "opacity-70")}
    >
      <StepTitle index={3} label={t("pl.step.add")} />
      <p className="mt-2 text-sm text-muted-foreground">{t("pl.addSub")}</p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2" role="radiogroup">
        {types.map((entry) => {
          const active = form.type === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => update("type", entry.id)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition duration-300",
                active
                  ? "border-primary/60 bg-primary/[0.09] glow-ring"
                  : "border-border/70 bg-secondary/40 hover:border-border",
              )}
            >
              <entry.icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span>
                <span className="block text-sm font-semibold">{entry.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{entry.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Label htmlFor="pl-name" className="mt-6 block text-sm font-medium">
        {t("pl.name")} <span className="font-normal text-muted-foreground">{t("pl.optional")}</span>
      </Label>
      <Input
        id="pl-name"
        value={form.name}
        maxLength={60}
        onChange={(event) => update("name", event.target.value)}
        placeholder={t("pl.namePlaceholder")}
        className={fieldClass}
      />

      {form.type === "m3u" ? (
        <>
          <Label htmlFor="pl-m3u" className="mt-5 block text-sm font-medium">
            {t("pl.m3uUrl")}
          </Label>
          <Input
            id="pl-m3u"
            value={form.m3uUrl}
            onChange={(event) => update("m3uUrl", event.target.value)}
            placeholder="http://srv.example.com/get.php?username=…&type=m3u_plus"
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            className={cn(fieldClass, "mono text-sm")}
          />
        </>
      ) : (
        <>
          <Label htmlFor="pl-server" className="mt-5 block text-sm font-medium">
            {t("pl.server")}
          </Label>
          <Input
            id="pl-server"
            value={form.server}
            onChange={(event) => update("server", event.target.value)}
            placeholder="http://srv.example.com:8080"
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            className={cn(fieldClass, "mono text-sm")}
          />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pl-user" className="mt-5 block text-sm font-medium">
                {t("pl.username")}
              </Label>
              <Input
                id="pl-user"
                value={form.username}
                onChange={(event) => update("username", event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className={fieldClass}
              />
            </div>
            <div>
              <Label htmlFor="pl-pass" className="mt-5 block text-sm font-medium">
                {t("pl.password")}
              </Label>
              <Input
                id="pl-pass"
                type="password"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                autoComplete="new-password"
                className={fieldClass}
              />
            </div>
          </div>
        </>
      )}

      <Label htmlFor="pl-epg" className="mt-5 block text-sm font-medium">
        {t("pl.epg")} <span className="font-normal text-muted-foreground">{t("pl.optional")}</span>
      </Label>
      <Input
        id="pl-epg"
        value={form.epgUrl}
        onChange={(event) => update("epgUrl", event.target.value)}
        placeholder="http://srv.example.com/xmltv.php"
        autoComplete="off"
        spellCheck={false}
        inputMode="url"
        className={cn(fieldClass, "mono text-sm")}
      />
      {form.type === "xtream" && <p className="mt-2 text-xs text-muted-foreground">{t("pl.epgHint")}</p>}

      {/* Last step before sending: the bot check. */}
      <div className="mt-7 rounded-2xl border border-border/80 bg-secondary/30 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {t("pl.captcha")}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("pl.captchaHelp")}</p>
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
      </div>

      {error && <ErrorBox message={error} />}
      {disabled && <ErrorBox message={t("pl.errLimit")} />}

      <Button
        type="submit"
        disabled={send.isPending || disabled || !captcha.data}
        className="mt-6 h-13 w-full gap-2.5 text-base font-semibold"
      >
        {send.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Plus className="h-4.5 w-4.5" />}
        {send.isPending ? t("pl.submitting") : t("pl.submit")}
      </Button>
    </form>
  );
}

function StepTitle({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="mono flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
        {index}
      </span>
      <span className="text-sm font-semibold uppercase tracking-wide text-foreground/80">{label}</span>
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

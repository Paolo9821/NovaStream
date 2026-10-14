import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CircleSlash,
  Clock,
  LifeBuoy,
  ListVideo,
  Loader2,
  PauseCircle,
  Search,
  ShieldX,
  Smartphone,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { LanguagePicker } from "@/components/LanguagePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchDeviceStatus,
  formatDate,
  isValidDeviceId,
  normalizeDeviceId,
  type DeviceStatus,
} from "@/lib/api";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Look = {
  icon: LucideIcon;
  title: TranslationKey;
  tone: string;
  /** Licence not usable: offer the way to the licence options on the home page. */
  needsLicence: boolean;
};

const LOOKS: Record<DeviceStatus["status"], Look> = {
  active: { icon: BadgeCheck, title: "dev.activeTitle", tone: "border-accent/30 bg-accent/10 text-accent", needsLicence: false },
  expired: { icon: Clock, title: "dev.expiredTitle", tone: "border-warning/30 bg-warning/10 text-warning", needsLicence: true },
  none: { icon: CircleSlash, title: "dev.noneTitle", tone: "border-border bg-secondary/50 text-foreground", needsLicence: true },
  suspended: { icon: PauseCircle, title: "dev.suspendedTitle", tone: "border-warning/30 bg-warning/10 text-warning", needsLicence: false },
  revoked: { icon: ShieldX, title: "dev.revokedTitle", tone: "border-destructive/30 bg-destructive/10 text-destructive", needsLicence: false },
};

/** Device id from the address bar, so a support link can open the page pre-filled. */
function initialDevice(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("device") ?? params.get("deviceId") ?? "";
}

/**
 * Device hub, the address the Android app names as plain text on its licence
 * screens. It shows no prices and no checkout: licence status, playlists, help.
 * Buying happens only on the home page.
 */
export default function Device() {
  const { t, locale } = useI18n();
  const [value, setValue] = useState<string>(initialDevice);
  const [inputError, setInputError] = useState<string>("");

  const lookup = useMutation({
    mutationFn: (deviceId: string) => fetchDeviceStatus(deviceId),
  });

  const submit = (raw: string): void => {
    if (!isValidDeviceId(raw)) {
      setInputError(t("dev.invalid"));
      return;
    }
    setInputError("");
    lookup.mutate(normalizeDeviceId(raw));
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (isValidDeviceId(value)) lookup.mutate(normalizeDeviceId(value));
    // Only the pre-filled id is checked automatically, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = lookup.data ?? null;
  const checkedId = lookup.variables ?? "";

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />

      <header className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">NovaStream</span>
        </div>
        <LanguagePicker />
      </header>

      <main className="relative mx-auto max-w-3xl px-5 pb-24">
        <div className="animate-rise mt-2 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary glow-ring">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t("dev.title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("dev.sub")}</p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(value);
          }}
          className="panel animate-rise mt-7 p-6 sm:p-7"
        >
          <Label htmlFor="dev-id" className="block text-sm font-medium">
            {t("dev.label")}
          </Label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input
              id="dev-id"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="A4:B1:C2:D3:E4:F5"
              autoComplete="off"
              spellCheck={false}
              className="mono h-12 border-border/80 bg-secondary/60 uppercase tracking-wider"
            />
            <Button type="submit" disabled={lookup.isPending || !value.trim()} className="h-12 gap-2 px-6 sm:w-auto">
              {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t("dev.check")}
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("dev.help")}</p>

          {inputError && <p className="mt-3 text-sm text-destructive">{inputError}</p>}
          {lookup.isError && !inputError && <p className="mt-3 text-sm text-destructive">{t("dev.failed")}</p>}

          {result && !inputError && (
            <StatusCard status={result} deviceId={checkedId} locale={locale} />
          )}
        </form>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <HubLink
            to="/playlist"
            icon={ListVideo}
            title={t("dev.playlistsTitle")}
            body={t("dev.playlistsBody")}
          />
          <HubLink
            to="/assistenza"
            icon={LifeBuoy}
            title={t("dev.supportTitle")}
            body={t("dev.supportBody")}
          />
        </div>
      </main>
    </div>
  );
}

function StatusCard({ status, deviceId, locale }: { status: DeviceStatus; deviceId: string; locale: string }) {
  const { t } = useI18n();
  const look = LOOKS[status.status] ?? LOOKS.none;
  const Icon = look.icon;

  const body = ((): string => {
    switch (status.status) {
      case "active":
        return status.expiresAt
          ? t("dev.activeUntil", { date: formatDate(status.expiresAt, locale) })
          : t("dev.activeLifetime");
      case "expired":
        return t("dev.expiredBody", { date: formatDate(status.expiresAt, locale) });
      case "suspended":
        return t("dev.suspendedBody");
      case "revoked":
        return t("dev.revokedBody");
      default:
        return t("dev.noneBody");
    }
  })();

  return (
    <div className={cn("animate-rise mt-5 rounded-2xl border p-5", look.tone)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">{t(look.title)}</p>
          <p className="mt-0.5 text-sm text-foreground/80">{body}</p>
          <p className="mono mt-2 truncate text-[11px] text-muted-foreground">{deviceId}</p>
        </div>
      </div>

      {look.needsLicence && (
        <div className="mt-4 border-t border-border/60 pt-4">
          <Button asChild className="h-11 w-full gap-2 font-semibold sm:w-auto">
            <Link to={`/?device=${encodeURIComponent(deviceId)}`}>
              {t("dev.plans")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("dev.afterBuy")}</p>
        </div>
      )}
      {(status.status === "suspended" || status.status === "revoked") && (
        <Button asChild variant="secondary" className="mt-4 h-11 gap-2">
          <Link to="/assistenza">
            <LifeBuoy className="h-4 w-4" />
            {t("dev.supportTitle")}
          </Link>
        </Button>
      )}
    </div>
  );
}

function HubLink(props: { to: string; icon: LucideIcon; title: string; body: string }) {
  const Icon = props.icon;
  return (
    <Link
      to={props.to}
      className="panel group flex items-start gap-3.5 p-5 transition hover:border-primary/40 active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{props.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{props.body}</p>
      </div>
      <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

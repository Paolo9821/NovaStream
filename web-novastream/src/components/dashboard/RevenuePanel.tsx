import { useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  History,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
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
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MiniStat } from "@/components/dashboard/ui";
import { formatDate, formatDateTime, formatMac, formatMonth, formatMoney, type OrderRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

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
export function RevenuePanel({
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

  const [orderSort, setOrderSort] = useState<OrderSort>({ key: "paid", dir: "desc" });
  const periodOrders = useMemo(() => {
    const list = orders.filter((order) => inPeriod(order.createdAt, view, cursor));
    const sign = orderSort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (orderSort.key === "consent") {
        // Orders without a confirmation always sink to the bottom.
        const ca = a.consent?.acceptedAt ?? null;
        const cb = b.consent?.acceptedAt ?? null;
        if (ca === null && cb === null) return b.createdAt - a.createdAt;
        if (ca === null) return 1;
        if (cb === null) return -1;
        return (ca - cb) * sign;
      }
      return (a.createdAt - b.createdAt) * sign;
    });
  }, [orders, view, cursor, orderSort]);

  const toggleSort = useCallback((key: OrderSortKey): void => {
    setOrderSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );
  }, []);

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
          <div className="mt-3">
            <div className={cn(ORDER_GRID, "px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground")}>
              <SortHeader label="Pagato il" active={orderSort.key === "paid"} dir={orderSort.dir} onClick={() => toggleSort("paid")} />
              <SortHeader
                label="Conferma prova"
                active={orderSort.key === "consent"}
                dir={orderSort.dir}
                onClick={() => toggleSort("consent")}
              />
              <span className="hidden sm:block">Piano</span>
              <span className="hidden sm:block">Dispositivo</span>
              <span className="hidden text-right sm:block">Importo</span>
            </div>
            <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {periodOrders.map((order) => (
                <OrderRow key={order.orderId} order={order} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type OrderSortKey = "paid" | "consent";
type OrderSort = { key: OrderSortKey; dir: "asc" | "desc" };

/** Shared column layout of the purchases header and rows. */
const ORDER_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[8.5rem_10rem_4.5rem_minmax(0,1fr)_4.5rem]";

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ordina per ${label.toLowerCase()}`}
      className={cn(
        "inline-flex items-center gap-1 text-left uppercase tracking-wider transition hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon className="h-3 w-3" />
    </button>
  );
}

/** Formats a timestamp down to the second, as needed when answering a dispute. */
function formatPrecise(ms: number): string {
  return new Date(ms).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

/** Compact date with seconds for the purchases column. */
function formatSeconds(ms: number): string {
  return new Date(ms).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** One purchase; opens up to show the pre-purchase confirmation kept as evidence. */
function OrderRow({ order }: { order: OrderRecord }) {
  const [open, setOpen] = useState<boolean>(false);
  const consent = order.consent;

  const copyEvidence = useCallback((): void => {
    if (!consent) return;
    const lines = [
      `Ordine: ${order.orderId}`,
      `Dispositivo: ${formatMac(order.deviceId)}`,
      `Importo: ${formatMoney(order.amountCents)}`,
      `Pagato il: ${formatPrecise(order.createdAt)}`,
      `Conferma spuntata il: ${formatPrecise(consent.acceptedAt)} (${new Date(consent.acceptedAt).toISOString()})`,
      `Registrata dal server il: ${formatPrecise(consent.recordedAt)} (${new Date(consent.recordedAt).toISOString()})`,
      `Indirizzo IP: ${consent.ip || "n/d"}`,
      `Browser: ${consent.userAgent || "n/d"}`,
      `Lingua: ${consent.lang || "n/d"}`,
      `Testo accettato: "${consent.text}"`,
    ];
    void navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast.success("Prova di conferma copiata"))
      .catch(() => toast.error("Copia non riuscita"));
  }, [consent, order]);

  return (
    <div className="rounded-xl border border-border/60 text-xs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(ORDER_GRID, "w-full px-3 py-2 text-left")}
      >
        <span className="text-muted-foreground">{formatDateTime(order.createdAt)}</span>
        <span
          title={consent ? `Spuntata il ${formatPrecise(consent.acceptedAt)}` : "Nessuna conferma registrata"}
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5",
            consent ? "text-accent" : "text-muted-foreground",
          )}
        >
          {consent ? <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> : <ShieldAlert className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{consent ? formatSeconds(consent.acceptedAt) : "Non registrata"}</span>
        </span>
        <span
          className={cn(
            "w-fit rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            order.plan === "lifetime"
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-accent/40 bg-accent/10 text-accent",
          )}
        >
          {order.plan === "lifetime" ? "A vita" : "12 mesi"}
        </span>
        <span className="min-w-0 truncate">
          <span className="mono text-muted-foreground">{formatMac(order.deviceId)}</span>
          {order.email && <span className="ml-2 text-muted-foreground/80">{order.email}</span>}
        </span>
        <span className="text-right font-bold">{formatMoney(order.amountCents)}</span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-border/60 px-3 py-2.5 text-muted-foreground">
          {consent ? (
            <>
              <div>
                <span className="text-foreground/80">Casella spuntata:</span> {formatPrecise(consent.acceptedAt)}
              </div>
              <div>
                <span className="text-foreground/80">Ricevuta dal server:</span> {formatPrecise(consent.recordedAt)}
              </div>
              <div>
                <span className="text-foreground/80">IP:</span> <span className="mono">{consent.ip || "n/d"}</span>
                {consent.lang && <> · <span className="text-foreground/80">Lingua:</span> {consent.lang.toUpperCase()}</>}
              </div>
              <div className="break-words">
                <span className="text-foreground/80">Browser:</span> {consent.userAgent || "n/d"}
              </div>
              <blockquote className="rounded-lg border-l-2 border-accent/60 bg-secondary/40 px-2.5 py-1.5 italic">
                {consent.text || "Testo non disponibile"}
              </blockquote>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="mono text-[10px]">{order.orderId}</span>
                <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={copyEvidence}>
                  Copia prova per contestazione
                </Button>
              </div>
            </>
          ) : (
            <p>
              Nessuna conferma registrata: ordine precedente all'introduzione della casella oppure licenza
              inserita a mano. <span className="mono text-[10px]">{order.orderId}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

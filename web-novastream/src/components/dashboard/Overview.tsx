import { useMemo, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Crown,
  Gift,
  Hourglass,
  Inbox,
  PauseCircle,
  Plus,
  TicketPercent,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MiniStat, Pill, StatCard } from "@/components/dashboard/ui";
import type { LicensesPayload, PromoPayload, TicketsPayload } from "@/hooks/useAdminData";
import { daysUntil, formatDate, formatDateTime, formatMac, formatMoney } from "@/lib/api";
import { codeState, termCodeLabel } from "@/lib/dashboard";

/** Places the overview can send the owner to. */
export type OverviewTarget =
  | "customers/trial"
  | "customers/subscription"
  | "customers/lifetime"
  | "customers/expired"
  | "sales"
  | "codes/gift"
  | "codes/discount"
  | "support/new";

const SOON_DAYS = 14;

export function Overview({
  licenses,
  tickets,
  promos,
  onGo,
  onGrant,
}: {
  licenses: LicensesPayload | undefined;
  tickets: TicketsPayload | undefined;
  promos: PromoPayload | undefined;
  onGo: (target: OverviewTarget) => void;
  onGrant: () => void;
}) {
  const stats = licenses?.stats;

  const expiringSoon = useMemo(() => {
    const limit = Date.now() + SOON_DAYS * 86_400_000;
    return (licenses?.licenses ?? [])
      .filter((row) => row.status === "active" && !row.expired && row.expiresAt !== null && row.expiresAt <= limit)
      .sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0));
  }, [licenses]);

  const pending = useMemo(
    () => (tickets?.tickets ?? []).filter((ticket) => ticket.status !== "closed").slice(0, 4),
    [tickets],
  );
  const activeCodes = (promos?.codes ?? []).filter((code) => codeState(code) === "active").length;
  const lastOrders = useMemo(() => [...(licenses?.orders ?? [])].reverse().slice(0, 5), [licenses]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Abbonamenti attivi"
          value={String(stats?.subscription ?? 0)}
          tone="text-accent"
          onClick={() => onGo("customers/subscription")}
        />
        <StatCard
          icon={Crown}
          label="Utenti a vita"
          value={String(stats?.lifetime ?? 0)}
          tone="text-warning"
          onClick={() => onGo("customers/lifetime")}
        />
        <StatCard
          icon={Hourglass}
          label="Utenti in prova"
          value={String(stats?.trialsActive ?? 0)}
          tone="text-primary"
          onClick={() => onGo("customers/trial")}
        />
        <StatCard
          icon={PauseCircle}
          label="Scaduti da recuperare"
          value={String(stats?.expired ?? 0)}
          tone="text-muted-foreground"
          onClick={() => onGo("customers/expired")}
        />
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-4 w-4 text-primary" /> Incassi
          </div>
          <Button variant="ghost" size="sm" onClick={() => onGo("sales")} className="gap-1.5 text-xs text-muted-foreground">
            Grafico e ordini <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="mt-3 grid gap-px border-t border-border/60 bg-border/60 sm:grid-cols-3">
          <MiniStat label="Ultimi 30 giorni" value={formatMoney(stats?.revenueCents30d ?? 0)} />
          <MiniStat label="Incasso totale" value={formatMoney(stats?.revenueCents ?? 0)} />
          <MiniStat label="Acquisti registrati" value={String(licenses?.orders.length ?? 0)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card
          icon={CalendarClock}
          title={`In scadenza nei prossimi ${SOON_DAYS} giorni`}
          count={expiringSoon.length}
          action={
            <Button variant="ghost" size="sm" onClick={() => onGo("customers/subscription")} className="gap-1.5 text-xs">
              Tutti <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          }
        >
          {expiringSoon.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nessuna licenza in scadenza a breve.</p>
          ) : (
            expiringSoon.slice(0, 6).map((row) => {
              const left = daysUntil(row.expiresAt ?? 0);
              return (
                <div key={row.deviceId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="mono min-w-0 flex-1 truncate">
                    {formatMac(row.deviceId)}
                    {row.label && <span className="ml-2 font-sans text-xs text-muted-foreground">{row.label}</span>}
                  </span>
                  <Pill tone="muted">{termCodeLabel(row.term)}</Pill>
                  <span className={left <= 3 ? "text-xs text-warning" : "text-xs text-muted-foreground"}>
                    {left === 0 ? "oggi" : `${left} gg`}
                  </span>
                </div>
              );
            })
          )}
        </Card>

        <Card
          icon={Inbox}
          title="Richieste da gestire"
          count={tickets?.openCount ?? 0}
          action={
            <Button variant="ghost" size="sm" onClick={() => onGo("support/new")} className="gap-1.5 text-xs">
              Apri <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          }
        >
          {pending.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Tutto gestito.</p>
          ) : (
            pending.map((ticket) => (
              <div key={ticket.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Pill tone={ticket.status === "new" ? "primary" : "warning"} strong>
                    {ticket.status === "new" ? "Nuova" : "In corso"}
                  </Pill>
                  <span className="truncate text-xs text-muted-foreground">{ticket.email}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {formatDateTime(ticket.createdAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-foreground/85">{ticket.message}</p>
              </div>
            ))
          )}
        </Card>

        <Card icon={CircleDollarSign} title="Ultimi acquisti" count={lastOrders.length}>
          {lastOrders.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Ancora nessun acquisto.</p>
          ) : (
            lastOrders.map((order) => (
              <div key={order.orderId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                <span className="mono min-w-0 flex-1 truncate text-xs">{formatMac(order.deviceId)}</span>
                <Pill tone={order.plan === "lifetime" ? "warning" : "accent"}>
                  {order.plan === "lifetime" ? "A vita" : "12 mesi"}
                </Pill>
                <span className="w-16 text-right font-semibold">{formatMoney(order.amountCents)}</span>
              </div>
            ))
          )}
        </Card>

        <div className="panel flex flex-col justify-between gap-4 p-5">
          <div>
            <h3 className="text-sm font-bold">Azioni rapide</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeCodes} {activeCodes === 1 ? "codice attivo" : "codici attivi"} sul sito
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button onClick={onGrant} className="h-11 gap-2">
              <Plus className="h-4 w-4" /> Attiva
            </Button>
            <Button variant="secondary" onClick={() => onGo("codes/gift")} className="h-11 gap-2">
              <Gift className="h-4 w-4" /> Regalo
            </Button>
            <Button variant="secondary" onClick={() => onGo("codes/discount")} className="h-11 gap-2">
              <TicketPercent className="h-4 w-4" /> Sconto
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  count,
  action,
  children,
}: {
  icon: typeof Users;
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Icon className="h-4 w-4 text-primary" />
          {title}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{count}</span>
        </div>
        {action}
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

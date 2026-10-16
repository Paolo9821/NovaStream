import type { ReactNode } from "react";
import { Copy, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { copyText } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

/** Small outlined action used in rows. */
export function RowButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40",
        danger
          ? "text-destructive hover:border-destructive/50 hover:bg-destructive/10"
          : "text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
  hint?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <Icon className={cn("h-4.5 w-4.5", tone)} />
        {hint && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </>
  );
  if (!onClick) return <div className="panel p-5">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="panel p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40"
    >
      {body}
    </button>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}

export type PillTone = "accent" | "warning" | "destructive" | "primary" | "muted";

const PILL_TONES: Record<PillTone, string> = {
  accent: "border-accent/40 bg-accent/10 text-accent",
  warning: "border-warning/40 bg-warning/10 text-warning",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  primary: "border-primary/50 bg-primary/15 text-primary",
  muted: "border-border/70 bg-secondary/60 text-muted-foreground",
};

/** Status chip; `strong` uses the uppercase look for states. */
export function Pill({ tone, children, strong }: { tone: PillTone; children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px]",
        strong ? "font-bold uppercase tracking-wider" : "font-medium",
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Title row at the top of every section of the console. */
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="max-w-sm">{children}</div>
    </div>
  );
}

/** Monospace value that copies itself when clicked. */
export function CopyChip({
  value,
  display,
  toastLabel = "Copiato",
  className,
}: {
  value: string;
  display?: string;
  toastLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(value).then((ok) => (ok ? toast.success(toastLabel) : toast.error("Copia non riuscita")));
      }}
      className={cn("mono group inline-flex min-w-0 items-center gap-1.5 text-left", className)}
    >
      <span className="truncate">{display ?? value}</span>
      <Copy className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}

/** Horizontal sub-folder tabs with counters. */
export function SubTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string; count?: number; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((item) => {
        const active = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
              active
                ? "border-primary/50 bg-primary/12 text-foreground"
                : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {Icon && <Icon className={cn("h-4 w-4", active && "text-primary")} />}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

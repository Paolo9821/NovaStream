import { CalendarDays, Infinity as InfinityIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { Term } from "@/lib/api";
import { endOfDay, isoDay } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export type TermPreset = "1m" | "3m" | "6m" | "12m" | "lifetime" | "date" | "days";

export type TermChoice = { preset: TermPreset; date: string; days: string };

export const defaultTermChoice = (preset: TermPreset = "12m"): TermChoice => ({
  preset,
  date: isoDay(30),
  days: "30",
});

/** Converts what the picker shows into the duration the server expects. */
export function choiceToTerm(choice: TermChoice): Term | null {
  switch (choice.preset) {
    case "1m":
      return { kind: "months", months: 1 };
    case "3m":
      return { kind: "months", months: 3 };
    case "6m":
      return { kind: "months", months: 6 };
    case "12m":
      return { kind: "months", months: 12 };
    case "lifetime":
      return { kind: "lifetime" };
    case "date": {
      const expiresAt = endOfDay(choice.date);
      return expiresAt && expiresAt > Date.now() ? { kind: "date", expiresAt } : null;
    }
    case "days": {
      const days = Math.round(Number(choice.days));
      return Number.isFinite(days) && days >= 1 && days <= 3650 ? { kind: "days", days } : null;
    }
  }
}

const PRESETS: { id: TermPreset; label: string }[] = [
  { id: "1m", label: "1 mese" },
  { id: "3m", label: "3 mesi" },
  { id: "6m", label: "6 mesi" },
  { id: "12m", label: "12 mesi" },
  { id: "lifetime", label: "A vita" },
];

/**
 * Duration chooser: 1/3/6/12 months, lifetime, plus either a calendar date
 * (manual grants) or a number of days (gift codes, which have no fixed start).
 */
export function TermPicker({
  value,
  onChange,
  custom,
}: {
  value: TermChoice;
  onChange: (value: TermChoice) => void;
  custom: "date" | "days";
}) {
  const options = [...PRESETS, custom === "date" ? { id: "date" as const, label: "Data…" } : { id: "days" as const, label: "Giorni…" }];
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {options.map((option) => {
          const active = value.preset === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ ...value, preset: option.id })}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition",
                active
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {option.id === "lifetime" && <InfinityIcon className="h-3.5 w-3.5" />}
              {(option.id === "date" || option.id === "days") && <CalendarDays className="h-3.5 w-3.5" />}
              {option.label}
            </button>
          );
        })}
      </div>
      {value.preset === "date" && (
        <Input
          type="date"
          min={isoDay(1)}
          value={value.date}
          onChange={(event) => onChange({ ...value, date: event.target.value })}
          className="h-11 border-border/80 bg-secondary/60"
        />
      )}
      {value.preset === "days" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={3650}
            value={value.days}
            onChange={(event) => onChange({ ...value, days: event.target.value })}
            className="h-11 w-32 border-border/80 bg-secondary/60"
          />
          <span className="text-sm text-muted-foreground">giorni dall'attivazione</span>
        </div>
      )}
    </div>
  );
}

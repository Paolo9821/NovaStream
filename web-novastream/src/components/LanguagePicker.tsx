import { Check, ChevronDown, Globe } from "lucide-react";

import { Flag } from "@/components/Flag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Compact flag + name control for the header. */
export function LanguagePicker() {
  const { lang, setLang } = useI18n();
  const current = LANGUAGES.find((entry) => entry.code === lang) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={current.name}
          className="flex items-center gap-2 rounded-full border border-border/70 py-1.5 pl-2 pr-3 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
        >
          <Flag code={current.flag} label={current.name} />
          <span className="hidden sm:inline">{current.name}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 border-border/70 bg-popover/95 backdrop-blur-xl">
        {LANGUAGES.map((entry) => (
          <DropdownMenuItem
            key={entry.code}
            onSelect={() => setLang(entry.code)}
            className="cursor-pointer gap-2.5 py-2"
          >
            <Flag code={entry.flag} label={entry.name} />
            <span className="flex-1 text-sm">{entry.name}</span>
            {entry.code === lang && <Check className="h-3.5 w-3.5 text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Full-width band of flags, so the choice is visible without hunting for it. */
export function LanguageSection() {
  const { lang, setLang, t } = useI18n();

  return (
    <section id="lingua" className="mt-20">
      <div className="panel p-6 sm:p-7">
        <div className="flex items-center gap-2.5">
          <Globe className="h-4.5 w-4.5 text-primary" />
          <h2 className="text-xl font-bold">{t("lang.title")}</h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("lang.sub")}</p>
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {LANGUAGES.map((entry) => {
            const active = entry.code === lang;
            return (
              <button
                key={entry.code}
                type="button"
                onClick={() => setLang(entry.code)}
                aria-pressed={active}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition duration-300",
                  active
                    ? "border-primary/60 bg-primary/[0.09] glow-ring"
                    : "border-border/70 bg-secondary/40 hover:border-border hover:bg-secondary/70",
                )}
              >
                <Flag
                  code={entry.flag}
                  label={entry.name}
                  className={cn(
                    "h-7 w-[42px] transition duration-300",
                    active ? "scale-105" : "opacity-80 group-hover:opacity-100",
                  )}
                />
                <span
                  className={cn(
                    "flex-1 text-sm font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {entry.name}
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

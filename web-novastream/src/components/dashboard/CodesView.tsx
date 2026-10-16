import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Copy,
  Gift,
  History,
  Link2,
  Loader2,
  Plus,
  Search,
  TicketPercent,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { choiceToTerm, defaultTermChoice, TermPicker, type TermChoice } from "@/components/dashboard/TermPicker";
import { CopyChip, EmptyState, Pill, SubTabs, type PillTone } from "@/components/dashboard/ui";
import { useAdminAction, type PromoPayload } from "@/hooks/useAdminData";
import { formatDate, formatDateTime, formatMac, formatMoney, type PlanId, type PromoCode } from "@/lib/api";
import { codeState, codeValueLabel, copyText, endOfDay, giftLink, isoDay, type CodeState } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export type CodeFolder = "discount" | "gift" | "history";

const STATE_PILL: Record<CodeState, { tone: PillTone; label: string }> = {
  active: { tone: "accent", label: "Attivo" },
  disabled: { tone: "muted", label: "Disattivato" },
  expired: { tone: "warning", label: "Scaduto" },
  usedUp: { tone: "muted", label: "Esaurito" },
};

const APPLIES_LABEL: Record<"all" | PlanId, string> = {
  all: "Tutte le formule",
  annual: "Solo 12 mesi",
  lifetime: "Solo a vita",
};

export function CodesView({
  token,
  data,
  loading,
  folder,
  onFolder,
}: {
  token: string;
  data: PromoPayload | undefined;
  loading: boolean;
  folder: CodeFolder;
  onFolder: (folder: CodeFolder) => void;
}) {
  const [creating, setCreating] = useState<"discount" | "gift" | null>(null);
  const [search, setSearch] = useState<string>("");
  const action = useAdminAction(token, ["promos"], "");

  const codes = useMemo(() => {
    const needle = search.trim().toUpperCase();
    return (data?.codes ?? []).filter(
      (code) => !needle || code.code.includes(needle) || code.note.toUpperCase().includes(needle),
    );
  }, [data, search]);
  const discounts = codes.filter((code) => code.kind !== "gift");
  const gifts = codes.filter((code) => code.kind === "gift");
  const redemptions = data?.redemptions ?? [];

  const tabs = [
    { id: "discount" as const, label: "Codici sconto", count: discounts.length, icon: TicketPercent },
    { id: "gift" as const, label: "Codici regalo", count: gifts.length, icon: Gift },
    { id: "history" as const, label: "Utilizzi", count: redemptions.length, icon: History },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca un codice o una nota"
            className="h-11 border-border/80 bg-secondary/60 pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCreating("discount")} className="h-11 gap-2">
            <TicketPercent className="h-4 w-4" /> Nuovo sconto
          </Button>
          <Button onClick={() => setCreating("gift")} className="h-11 gap-2">
            <Gift className="h-4 w-4" /> Nuovo regalo
          </Button>
        </div>
      </div>

      <SubTabs items={tabs} value={folder} onChange={onFolder} />

      {loading ? (
        <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico i codici…
        </div>
      ) : folder === "history" ? (
        <RedemptionList data={data} />
      ) : (
        <CodeTable
          codes={folder === "gift" ? gifts : discounts}
          gift={folder === "gift"}
          busy={action.isPending}
          onToggle={(code, active) => action.mutate({ path: "/api/admin/promo-toggle", body: { code, active } })}
          onRemove={(code) => {
            if (window.confirm(`Eliminare il codice ${code}? Gli utilizzi già fatti restano nello storico.`)) {
              action.mutate({ path: "/api/admin/promo-remove", body: { code } });
            }
          }}
        />
      )}

      <CreateCodeDialog
        token={token}
        mode={creating}
        onClose={() => setCreating(null)}
        onCreated={(kind) => onFolder(kind === "gift" ? "gift" : "discount")}
      />
    </div>
  );
}

const CODE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,1.4fr)_7rem_8rem_6rem_7.5rem_auto]";

function CodeTable({
  codes,
  gift,
  busy,
  onToggle,
  onRemove,
}: {
  codes: PromoCode[];
  gift: boolean;
  busy: boolean;
  onToggle: (code: string, active: boolean) => void;
  onRemove: (code: string) => void;
}) {
  if (codes.length === 0) {
    return (
      <EmptyState icon={gift ? Gift : TicketPercent}>
        {gift
          ? "Nessun codice regalo. Creane uno per regalare una licenza: chi lo inserisce sul sito la attiva senza pagare."
          : "Nessun codice sconto. Creane uno (es. NATALE20) da dare ai clienti: lo inseriscono al pagamento."}
      </EmptyState>
    );
  }
  return (
    <div className="panel overflow-hidden">
      <div
        className={cn(
          CODE_GRID,
          "hidden border-b border-border/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid",
        )}
      >
        <span>Codice</span>
        <span>{gift ? "Regala" : "Sconto"}</span>
        <span>{gift ? "Creato" : "Vale per"}</span>
        <span>Utilizzi</span>
        <span>Stato</span>
        <span className="w-[6.5rem]" />
      </div>
      <div className="divide-y divide-border/50">
        {codes.map((code) => {
          const state = codeState(code);
          const pill = STATE_PILL[state];
          const uses = `${code.usedCount}/${code.maxUses === 0 ? "∞" : code.maxUses}`;
          return (
            <div key={code.code} className={cn(CODE_GRID, "px-4 py-3.5 transition hover:bg-secondary/25")}>
              <div className="min-w-0">
                <CopyChip value={code.code} toastLabel="Codice copiato" className="text-sm font-bold tracking-wider" />
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  {code.note && <span className="text-foreground/80">{code.note}</span>}
                  {code.batch && <span className="mono">lotto {code.batch}</span>}
                  {code.expiresAt && <span>valido fino al {formatDate(code.expiresAt)}</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 lg:hidden">
                  <Pill tone={gift ? "primary" : "accent"}>{codeValueLabel(code)}</Pill>
                  <Pill tone={pill.tone} strong>
                    {pill.label}
                  </Pill>
                  <span className="text-xs text-muted-foreground">{uses} utilizzi</span>
                </div>
              </div>
              <div className="hidden text-sm font-semibold lg:block">{codeValueLabel(code)}</div>
              <div className="hidden text-xs text-muted-foreground lg:block">
                {gift ? formatDate(code.createdAt) : APPLIES_LABEL[code.appliesTo]}
              </div>
              <div className="mono hidden text-sm lg:block">{uses}</div>
              <div className="hidden lg:block">
                <Pill tone={pill.tone} strong>
                  {pill.label}
                </Pill>
              </div>
              <div className="flex items-center justify-end gap-1">
                {gift && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="Copia link regalo"
                    title="Copia link regalo"
                    onClick={() =>
                      void copyText(giftLink(code.code)).then((ok) =>
                        ok ? toast.success("Link regalo copiato") : toast.error("Copia non riuscita"),
                      )
                    }
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                )}
                <Switch
                  checked={code.active}
                  disabled={busy}
                  onCheckedChange={(value) => onToggle(code.code, value)}
                  aria-label={code.active ? "Disattiva codice" : "Attiva codice"}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  aria-label="Elimina codice"
                  onClick={() => onRemove(code.code)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RedemptionList({ data }: { data: PromoPayload | undefined }) {
  const rows = data?.redemptions ?? [];
  const kinds = useMemo(() => new Map((data?.codes ?? []).map((code) => [code.code, code.kind])), [data]);
  if (rows.length === 0) {
    return <EmptyState icon={History}>Nessun codice usato finora. Ogni utilizzo comparirà qui.</EmptyState>;
  }
  const saved = rows.reduce((sum, row) => sum + row.discountCents, 0);
  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border/60 px-4 py-3 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{rows.length}</strong> utilizzi
        </span>
        <span>
          Sconti concessi: <strong className="text-foreground">{formatMoney(saved)}</strong>
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {rows.map((row) => {
          const gift = (kinds.get(row.code) ?? (row.orderId ? "percent" : "gift")) === "gift";
          return (
            <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <span className="w-36 shrink-0 text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>
              <span className="mono font-semibold">{row.code}</span>
              <Pill tone={gift ? "primary" : "accent"}>{gift ? "Regalo" : "Sconto"}</Pill>
              <span className="mono text-xs text-muted-foreground">{formatMac(row.deviceId)}</span>
              {row.email && <span className="text-xs text-muted-foreground">{row.email}</span>}
              <span className="ml-auto text-right text-xs">
                {row.orderId ? (
                  <>
                    pagato <strong>{formatMoney(row.paidCents)}</strong> · sconto {formatMoney(row.discountCents)}
                  </>
                ) : (
                  <span className="text-accent">gratis</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type DiscountKind = "percent" | "amount";

function CreateCodeDialog({
  token,
  mode,
  onClose,
  onCreated,
}: {
  token: string;
  mode: "discount" | "gift" | null;
  onClose: () => void;
  onCreated: (kind: "discount" | "gift") => void;
}) {
  const [discountKind, setDiscountKind] = useState<DiscountKind>("percent");
  const [percent, setPercent] = useState<string>("20");
  const [amount, setAmount] = useState<string>("1,00");
  const [appliesTo, setAppliesTo] = useState<"all" | PlanId>("all");
  const [choice, setChoice] = useState<TermChoice>(() => defaultTermChoice("12m"));
  const [naming, setNaming] = useState<"auto" | "custom">("auto");
  const [customCode, setCustomCode] = useState<string>("");
  const [count, setCount] = useState<string>("1");
  const [unlimited, setUnlimited] = useState<boolean>(false);
  const [maxUses, setMaxUses] = useState<string>("1");
  const [hasExpiry, setHasExpiry] = useState<boolean>(false);
  const [expiry, setExpiry] = useState<string>(isoDay(30));
  const [note, setNote] = useState<string>("");
  const [created, setCreated] = useState<string[]>([]);

  useEffect(() => {
    if (!mode) return;
    setDiscountKind("percent");
    setPercent("20");
    setAmount("1,00");
    setAppliesTo("all");
    setChoice(defaultTermChoice("12m"));
    setNaming(mode === "discount" ? "custom" : "auto");
    setCustomCode("");
    setCount("1");
    // A discount is usually shared (unlimited); a gift is one licence for one person.
    setUnlimited(mode === "discount");
    setMaxUses("1");
    setHasExpiry(false);
    setExpiry(isoDay(30));
    setNote("");
    setCreated([]);
  }, [mode]);

  const create = useAdminAction<{ ok: boolean; codes?: string[] }>(token, ["promos"], (data) =>
    (data.codes?.length ?? 0) > 1 ? `${data.codes?.length} codici creati` : "Codice creato",
  );

  const gift = mode === "gift";
  const term = gift ? choiceToTerm(choice) : null;
  const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
  const percentValue = Math.round(Number(percent));
  const countValue = Math.round(Number(count));
  const maxUsesValue = Math.round(Number(maxUses));

  const problem = ((): string => {
    if (gift && !term) return "Scegli una durata valida.";
    if (!gift && discountKind === "percent" && !(percentValue >= 1 && percentValue <= 100))
      return "La percentuale va da 1 a 100.";
    if (!gift && discountKind === "amount" && !(amountCents >= 1)) return "Inserisci un importo valido.";
    if (naming === "custom" && !/^[A-Za-z0-9-]{3,32}$/.test(customCode.trim()))
      return "Il codice deve avere 3-32 caratteri: lettere, numeri o trattini.";
    if (naming === "auto" && !(countValue >= 1 && countValue <= 200)) return "Puoi generare da 1 a 200 codici.";
    if (!unlimited && !(maxUsesValue >= 1)) return "Indica quante volte si può usare.";
    if (hasExpiry && !endOfDay(expiry)) return "Data di scadenza non valida.";
    return "";
  })();

  const submit = (): void => {
    create.mutate(
      {
        path: "/api/admin/promo-create",
        body: {
          kind: gift ? "gift" : discountKind,
          value: gift ? 0 : discountKind === "percent" ? percentValue : amountCents,
          appliesTo,
          term,
          code: naming === "custom" ? customCode.trim() : "",
          count: naming === "auto" ? countValue : 1,
          maxUses: unlimited ? 0 : maxUsesValue,
          expiresAt: hasExpiry ? endOfDay(expiry) : null,
          note,
        },
      },
      {
        onSuccess: (data) => {
          setCreated(data.codes ?? []);
          if (mode) onCreated(mode);
        },
      },
    );
  };

  const copyAll = (): void => {
    const text = gift ? created.map((code) => `${code}  ${giftLink(code)}`).join("\n") : created.join("\n");
    void copyText(text).then((ok) => (ok ? toast.success("Codici copiati") : toast.error("Copia non riuscita")));
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {gift ? <Gift className="h-4.5 w-4.5 text-primary" /> : <TicketPercent className="h-4.5 w-4.5 text-primary" />}
            {created.length > 0 ? "Codici pronti" : gift ? "Nuovo codice regalo" : "Nuovo codice sconto"}
          </DialogTitle>
          <DialogDescription>
            {created.length > 0
              ? gift
                ? "Consegna il codice o il link: chi lo usa sul sito attiva la licenza senza pagare."
                : "I clienti lo inseriscono sul sito, nel passaggio del pagamento."
              : gift
                ? "Regala una licenza: chi inserisce il codice sul sito la attiva gratis sul suo dispositivo."
                : "Riduce il prezzo al pagamento sul sito."}
          </DialogDescription>
        </DialogHeader>

        {created.length > 0 ? (
          <div className="space-y-3">
            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-secondary/40 p-3">
              {created.map((code) => (
                <div key={code} className="flex items-center justify-between gap-3">
                  <CopyChip value={code} toastLabel="Codice copiato" className="text-sm font-bold tracking-wider" />
                  {gift && (
                    <CopyChip
                      value={giftLink(code)}
                      display="link"
                      toastLabel="Link copiato"
                      className="text-xs text-muted-foreground"
                    />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={copyAll} className="gap-2">
                <Copy className="h-4 w-4" /> Copia {created.length > 1 ? "tutti" : ""}
              </Button>
              <Button onClick={onClose}>Fatto</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            {gift ? (
              <Field label="Licenza regalata">
                <TermPicker value={choice} onChange={setChoice} custom="days" />
              </Field>
            ) : (
              <>
                <Field label="Tipo di sconto">
                  <Segmented<DiscountKind>
                    value={discountKind}
                    onChange={setDiscountKind}
                    options={[
                      ["percent", "Percentuale"],
                      ["amount", "Importo fisso"],
                    ]}
                  />
                  <div className="mt-2.5 flex items-center gap-2">
                    {discountKind === "percent" ? (
                      <>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={percent}
                          onChange={(event) => setPercent(event.target.value)}
                          className="h-11 w-28 border-border/80 bg-secondary/60"
                        />
                        <span className="text-sm text-muted-foreground">% di sconto (100% = gratis)</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-muted-foreground">€</span>
                        <Input
                          inputMode="decimal"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          className="h-11 w-28 border-border/80 bg-secondary/60"
                        />
                        <span className="text-sm text-muted-foreground">in meno sul prezzo</span>
                      </>
                    )}
                  </div>
                </Field>
                <Field label="Vale per">
                  <Segmented<"all" | PlanId>
                    value={appliesTo}
                    onChange={setAppliesTo}
                    options={[
                      ["all", "Tutte"],
                      ["annual", "12 mesi"],
                      ["lifetime", "A vita"],
                    ]}
                  />
                </Field>
              </>
            )}

            <Field label="Codice">
              <Segmented<"auto" | "custom">
                value={naming}
                onChange={setNaming}
                options={[
                  ["auto", "Genera in automatico"],
                  ["custom", "Scegli tu"],
                ]}
              />
              <div className="mt-2.5">
                {naming === "custom" ? (
                  <Input
                    value={customCode}
                    onChange={(event) => setCustomCode(event.target.value.toUpperCase())}
                    placeholder={gift ? "es. REGALO-MARCO" : "es. NATALE20"}
                    className="mono h-11 border-border/80 bg-secondary/60 uppercase tracking-wider"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={count}
                      onChange={(event) => setCount(event.target.value)}
                      className="h-11 w-24 border-border/80 bg-secondary/60"
                    />
                    <span className="text-sm text-muted-foreground">
                      {countValue > 1 ? "codici diversi, tipo NOVA-ABCD-1234" : "codice, tipo NOVA-ABCD-1234"}
                    </span>
                  </div>
                )}
              </div>
            </Field>

            <Field label={naming === "auto" && countValue > 1 ? "Utilizzi per ogni codice" : "Utilizzi"}>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={unlimited} onCheckedChange={setUnlimited} />
                  Illimitati
                </label>
                {!unlimited && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={maxUses}
                      onChange={(event) => setMaxUses(event.target.value)}
                      className="h-10 w-24 border-border/80 bg-secondary/60"
                    />
                    <span className="text-sm text-muted-foreground">{maxUsesValue === 1 ? "volta" : "volte"}</span>
                  </div>
                )}
              </div>
            </Field>

            <Field label="Scadenza del codice">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={hasExpiry} onCheckedChange={setHasExpiry} />
                  {hasExpiry ? "Usabile fino al" : "Nessuna scadenza"}
                </label>
                {hasExpiry && (
                  <Input
                    type="date"
                    min={isoDay(0)}
                    value={expiry}
                    onChange={(event) => setExpiry(event.target.value)}
                    className="h-10 w-44 border-border/80 bg-secondary/60"
                  />
                )}
              </div>
            </Field>

            <Field label="Nota (solo per te)">
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={gift ? "es. Giveaway Instagram" : "es. Promo Natale"}
                className="h-11 border-border/80 bg-secondary/60"
              />
            </Field>

            {problem && <p className="text-xs text-warning">{problem}</p>}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Annulla
              </Button>
              <Button disabled={Boolean(problem) || create.isPending} onClick={submit} className="gap-2">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crea {naming === "auto" && countValue > 1 ? `${countValue} codici` : "codice"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border/70 p-0.5">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "rounded-[10px] px-3.5 py-1.5 text-sm font-medium transition",
            value === id ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

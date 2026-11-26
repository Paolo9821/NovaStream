import { useMemo, useState, type ReactNode } from "react";
import {
  Ban,
  ChevronDown,
  Coins,
  Gift,
  KeyRound,
  Link2,
  Loader2,
  Minus,
  Pencil,
  PlayCircle,
  Plus,
  ShieldOff,
  Store,
  Trash2,
  Users,
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
import { Textarea } from "@/components/ui/textarea";
import { CopyChip, EmptyState, Pill, RowButton } from "@/components/dashboard/ui";
import { useAdminAction, type LicensesPayload, type PromoPayload } from "@/hooks/useAdminData";
import { formatDate, formatDateTime, formatMac, type ResellerInfo } from "@/lib/api";
import { codeValueLabel, deviceLabel, licenseState, sortByExpiry } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const RESELLER_PANEL = "https://novastreamapp.com/reseller";

export function ResellersView({
  token,
  resellers,
  loading,
  licenses,
  promos,
}: {
  token: string;
  resellers: ResellerInfo[];
  loading: boolean;
  licenses: LicensesPayload | undefined;
  promos: PromoPayload | undefined;
}) {
  const [creating, setCreating] = useState<boolean>(false);
  const [editing, setEditing] = useState<ResellerInfo | null>(null);
  const [assigning, setAssigning] = useState<ResellerInfo | null>(null);
  const [credits, setCredits] = useState<ResellerInfo | null>(null);
  const [open, setOpen] = useState<string>("");
  const action = useAdminAction(token, ["resellers", "licenses", "promos"]);

  const totals = useMemo(
    () => ({
      credits: resellers.reduce((sum, r) => sum + r.credits, 0),
      spent: resellers.reduce((sum, r) => sum + r.creditsSpent, 0),
      licenses: resellers.reduce((sum, r) => sum + r.stats.licenses, 0),
    }),
    [resellers],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{resellers.length}</strong> rivenditori
          </span>
          <span>
            Crediti disponibili: <strong className="text-foreground">{totals.credits}</strong>
          </span>
          <span>
            Crediti usati: <strong className="text-foreground">{totals.spent}</strong>
          </span>
          <span>
            Licenze nei loro pannelli: <strong className="text-foreground">{totals.licenses}</strong>
          </span>
        </div>
        <Button
          variant="secondary"
          className="h-11 gap-2"
          onClick={() =>
            void navigator.clipboard
              .writeText(RESELLER_PANEL)
              .then(() => toast.success("Indirizzo del pannello copiato"))
              .catch(() => toast.error("Copia non riuscita"))
          }
        >
          <Link2 className="h-4 w-4" /> Link pannello
        </Button>
        <Button onClick={() => setCreating(true)} className="h-11 gap-2">
          <Plus className="h-4 w-4" /> Nuovo rivenditore
        </Button>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        1 credito = 1 anno di licenza. I rivenditori entrano da {RESELLER_PANEL.replace("https://", "")} e al primo
        accesso attivano la verifica in due passaggi.
      </p>

      {loading ? (
        <div className="panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico i rivenditori…
        </div>
      ) : resellers.length === 0 ? (
        <EmptyState icon={Store}>
          Nessun rivenditore. Creane uno con nome utente e password, poi caricagli dei crediti.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {resellers.map((reseller) => {
            const expanded = open === reseller.id;
            return (
              <div key={reseller.id} className={cn("panel overflow-hidden", reseller.disabled && "opacity-70")}>
                <div className="flex flex-wrap items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold">{reseller.username}</span>
                      {reseller.disabled ? (
                        <Pill tone="destructive" strong>
                          Sospeso
                        </Pill>
                      ) : (
                        <Pill tone="accent" strong>
                          Attivo
                        </Pill>
                      )}
                      <Pill tone={reseller.twofaEnabled ? "primary" : "warning"}>
                        {reseller.twofaEnabled ? "2FA attiva" : "2FA da configurare"}
                      </Pill>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Creato il {formatDate(reseller.createdAt)}</span>
                      <span>Ultimo accesso: {reseller.lastLoginAt ? formatDateTime(reseller.lastLoginAt) : "mai"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums">{reseller.credits}</div>
                    <div className="text-[11px] text-muted-foreground">crediti</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px border-y border-border/50 bg-border/50 sm:grid-cols-4">
                  <Stat label="Licenze attivate" value={`${reseller.stats.liveLicenses}/${reseller.stats.licenses}`} />
                  <Stat label="Codici creati" value={`${reseller.stats.codesUsed}/${reseller.stats.codes} usati`} />
                  <Stat
                    label="Riscatti"
                    value={`${reseller.stats.redemptions}${reseller.stats.revokedRedemptions ? ` (${reseller.stats.revokedRedemptions} cancellati)` : ""}`}
                  />
                  <Stat
                    label="Crediti caricati / usati"
                    value={`${reseller.creditsAdded} / ${reseller.creditsSpent}`}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-3">
                  <RowButton icon={Coins} label="Crediti" disabled={action.isPending} onClick={() => setCredits(reseller)} />
                  <RowButton icon={Users} label="Assegna licenze" disabled={action.isPending} onClick={() => setAssigning(reseller)} />
                  <RowButton icon={Pencil} label="Nome e password" disabled={action.isPending} onClick={() => setEditing(reseller)} />
                  <RowButton
                    icon={ShieldOff}
                    label="Reset 2FA"
                    disabled={action.isPending || !reseller.twofaEnabled}
                    onClick={() => {
                      if (window.confirm(`Azzerare la verifica in due passaggi di ${reseller.username}? Al prossimo accesso la configurerà di nuovo.`)) {
                        action.mutate({ path: "/api/admin/reseller-reset-2fa", body: { id: reseller.id } });
                      }
                    }}
                  />
                  <RowButton
                    icon={reseller.disabled ? PlayCircle : Ban}
                    label={reseller.disabled ? "Riattiva" : "Sospendi"}
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: "/api/admin/reseller-disable",
                        body: { id: reseller.id, disabled: !reseller.disabled },
                      })
                    }
                  />
                  <RowButton
                    icon={Trash2}
                    label="Elimina"
                    danger
                    disabled={action.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Eliminare l'account ${reseller.username}? Le sue licenze e i suoi codici restano attivi e tornano a te.`,
                        )
                      ) {
                        action.mutate({ path: "/api/admin/reseller-delete", body: { id: reseller.id } });
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? "" : reseller.id)}
                    className="ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Dettagli <ChevronDown className={cn("h-3.5 w-3.5 transition", expanded && "rotate-180")} />
                  </button>
                </div>

                {expanded && <ResellerDetail reseller={reseller} licenses={licenses} promos={promos} />}
              </div>
            );
          })}
        </div>
      )}

      <CreateResellerDialog token={token} open={creating} onClose={() => setCreating(false)} />
      <EditResellerDialog token={token} reseller={editing} onClose={() => setEditing(null)} />
      <AssignDialog token={token} reseller={assigning} onClose={() => setAssigning(null)} />
      <CreditsDialog token={token} reseller={credits} onClose={() => setCredits(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

/** What one reseller sold, which codes they made and who used them. */
function ResellerDetail({
  reseller,
  licenses,
  promos,
}: {
  reseller: ResellerInfo;
  licenses: LicensesPayload | undefined;
  promos: PromoPayload | undefined;
}) {
  const rows = sortByExpiry((licenses?.licenses ?? []).filter((row) => row.resellerId === reseller.id));
  const codes = (promos?.codes ?? []).filter((code) => code.resellerId === reseller.id);
  const uses = (promos?.redemptions ?? []).filter((use) => use.resellerId === reseller.id);

  return (
    <div className="grid gap-4 border-t border-border/50 bg-secondary/20 p-4 lg:grid-cols-3">
      <DetailList title={`Licenze (${rows.length})`} empty="Nessuna licenza.">
        {rows.slice(0, 100).map((row) => {
          const state = licenseState(row);
          return (
            <div key={row.deviceId} className="py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <CopyChip value={row.deviceId} display={formatMac(row.deviceId)} className="font-semibold" />
                <Pill tone={state === "active" ? "accent" : state === "revoked" ? "destructive" : "warning"}>
                  {state === "active" ? (row.expiresAt ? `fino al ${formatDate(row.expiresAt)}` : "a vita") : state === "expired" ? "scaduta" : state === "revoked" ? "revocata" : "sospesa"}
                </Pill>
              </div>
              <div className="mt-0.5 text-muted-foreground">
                {[row.email, deviceLabel(row.device), row.resellerNote].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          );
        })}
      </DetailList>
      <DetailList title={`Codici (${codes.length})`} empty="Nessun codice.">
        {codes.slice(0, 100).map((code) => (
          <div key={code.code} className="flex items-center justify-between gap-2 py-2 text-xs">
            <CopyChip value={code.code} className="font-semibold tracking-wider" />
            <span className="text-muted-foreground">
              {codeValueLabel(code)} · {code.usedCount}/{code.maxUses === 0 ? "∞" : code.maxUses}
            </span>
          </div>
        ))}
      </DetailList>
      <DetailList title={`Riscatti (${uses.length})`} empty="Nessun codice riscattato.">
        {uses.slice(0, 100).map((use) => (
          <div key={use.id} className="py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className={cn("mono font-semibold", use.status === "revoked" && "line-through opacity-60")}>
                {use.code}
              </span>
              <span className="text-muted-foreground">{formatDateTime(use.createdAt)}</span>
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {formatMac(use.deviceId)}
              {use.email ? ` · ${use.email}` : ""}
            </div>
          </div>
        ))}
      </DetailList>
    </div>
  );
}

function DetailList({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Gift className="h-3 w-3" /> {title}
      </div>
      {children.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="max-h-72 divide-y divide-border/50 overflow-y-auto">{children}</div>
      )}
    </div>
  );
}

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function CreateResellerDialog({ token, open, onClose }: { token: string; open: boolean; onClose: () => void }) {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [credits, setCredits] = useState<string>("0");
  const create = useAdminAction(token, ["resellers"], "Rivenditore creato");

  const name = username.trim().toLowerCase();
  const creditsValue = Math.round(Number(credits));
  const problem = !USERNAME_RE.test(name)
    ? "Nome utente: 3-32 caratteri, lettere minuscole, numeri, punto, trattino."
    : password.length < 8
      ? "La password deve avere almeno 8 caratteri."
      : !(creditsValue >= 0)
        ? "Crediti non validi."
        : "";

  const close = (): void => {
    setUsername("");
    setPassword("");
    setCredits("0");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-4.5 w-4.5 text-primary" /> Nuovo rivenditore
          </DialogTitle>
          <DialogDescription>
            Comunica nome utente e password al rivenditore: al primo accesso collegherà la sua app di autenticazione.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nome utente">
            <Input
              value={username}
              autoComplete="off"
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              placeholder="es. mario.tv"
              className="h-11 border-border/80 bg-secondary/60"
            />
          </Field>
          <Field label="Password (almeno 8 caratteri)">
            <Input
              type="text"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mono h-11 border-border/80 bg-secondary/60"
            />
          </Field>
          <Field label="Crediti iniziali (1 credito = 1 anno)">
            <Input
              type="number"
              min={0}
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
              className="h-11 w-32 border-border/80 bg-secondary/60"
            />
          </Field>
          {problem && (username || password) && <p className="text-xs text-warning">{problem}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={close}>
              Annulla
            </Button>
            <Button
              disabled={Boolean(problem) || create.isPending}
              className="gap-2"
              onClick={() =>
                create.mutate(
                  { path: "/api/admin/reseller-create", body: { username: name, password, credits: creditsValue } },
                  { onSuccess: close },
                )
              }
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crea
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditResellerDialog({
  token,
  reseller,
  onClose,
}: {
  token: string;
  reseller: ResellerInfo | null;
  onClose: () => void;
}) {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const save = useAdminAction(token, ["resellers"], "Rivenditore aggiornato");

  const name = username.trim().toLowerCase();
  const changedName = Boolean(name) && name !== reseller?.username;
  const problem =
    name && !USERNAME_RE.test(name)
      ? "Nome utente: 3-32 caratteri, lettere minuscole, numeri, punto, trattino."
      : password && password.length < 8
        ? "La password deve avere almeno 8 caratteri."
        : !changedName && !password
          ? "Cambia il nome utente o scrivi una nuova password."
          : "";

  const close = (): void => {
    setUsername("");
    setPassword("");
    onClose();
  };

  return (
    <Dialog open={reseller !== null} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4.5 w-4.5 text-primary" /> {reseller?.username}
          </DialogTitle>
          <DialogDescription>
            Cambiando la password il rivenditore viene disconnesso da tutti i dispositivi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nuovo nome utente">
            <Input
              value={username}
              placeholder={reseller?.username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              className="h-11 border-border/80 bg-secondary/60"
            />
          </Field>
          <Field label="Nuova password">
            <Input
              type="text"
              autoComplete="new-password"
              value={password}
              placeholder="lascia vuoto per non cambiarla"
              onChange={(event) => setPassword(event.target.value)}
              className="mono h-11 border-border/80 bg-secondary/60"
            />
          </Field>
          {problem && (username || password) && <p className="text-xs text-warning">{problem}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={close}>
              Annulla
            </Button>
            <Button
              disabled={Boolean(problem) || save.isPending || !reseller}
              className="gap-2"
              onClick={() =>
                reseller &&
                save.mutate(
                  {
                    path: "/api/admin/reseller-update",
                    body: { id: reseller.id, ...(changedName ? { username: name } : {}), ...(password ? { password } : {}) },
                  },
                  { onSuccess: close },
                )
              }
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salva
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreditsDialog({ token, reseller, onClose }: { token: string; reseller: ResellerInfo | null; onClose: () => void }) {
  const [amount, setAmount] = useState<string>("10");
  const save = useAdminAction<{ ok: boolean; credits?: number; username?: string }>(
    token,
    ["resellers"],
    (data) => `${data.username ?? "Rivenditore"}: ora ${data.credits ?? 0} crediti`,
  );
  const value = Math.round(Number(amount));
  const valid = value >= 1 && value <= 100_000;

  const apply = (sign: 1 | -1): void => {
    if (!reseller || !valid) return;
    save.mutate({ path: "/api/admin/reseller-credits", body: { id: reseller.id, delta: sign * value } }, { onSuccess: onClose });
  };

  return (
    <Dialog open={reseller !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-4.5 w-4.5 text-primary" /> Crediti di {reseller?.username}
          </DialogTitle>
          <DialogDescription>
            Ne ha {reseller?.credits ?? 0}. 1 credito = 1 anno di licenza. I crediti non scendono mai sotto zero.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {[1, 5, 10, 25, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  value === preset ? "border-primary/50 bg-primary/15" : "border-border/70 text-muted-foreground",
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-11 border-border/80 bg-secondary/60"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" disabled={!valid || save.isPending} onClick={() => apply(-1)} className="gap-2">
              <Minus className="h-4 w-4" /> Togli
            </Button>
            <Button disabled={!valid || save.isPending} onClick={() => apply(1)} className="gap-2">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Carica {valid ? value : ""}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ token, reseller, onClose }: { token: string; reseller: ResellerInfo | null; onClose: () => void }) {
  const [text, setText] = useState<string>("");
  const [result, setResult] = useState<{ assigned: string[]; notFound: string[] } | null>(null);
  const assign = useAdminAction<{ ok: boolean; assigned?: string[]; notFound?: string[] }>(
    token,
    ["licenses", "resellers"],
    (data) => `${data.assigned?.length ?? 0} licenze assegnate`,
  );
  const identifiers = text.split(/[\s,;]+/).filter(Boolean);

  const close = (): void => {
    setText("");
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={reseller !== null} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-primary" /> Assegna licenze a {reseller?.username}
          </DialogTitle>
          <DialogDescription>
            Incolla i MAC o gli ID dei dispositivi, uno per riga. Le licenze trovate compariranno nel suo pannello.
            Non costa crediti.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{result.assigned.length}</strong> licenze assegnate.
            </p>
            {result.notFound.length > 0 && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
                <div className="mb-1 font-semibold text-warning">Nessuna licenza trovata per:</div>
                <div className="mono">{result.notFound.map(formatMac).join(", ")}</div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={close}>Fatto</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={7}
              placeholder={"00:1A:2B:3C:4D:5E\nA1B2C3D4E5F6"}
              className="mono border-border/80 bg-secondary/60"
            />
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Annulla
              </Button>
              <Button
                disabled={identifiers.length === 0 || assign.isPending || !reseller}
                className="gap-2"
                onClick={() =>
                  reseller &&
                  assign.mutate(
                    { path: "/api/admin/assign-reseller", body: { identifiers, resellerId: reseller.id } },
                    { onSuccess: (data) => setResult({ assigned: data.assigned ?? [], notFound: data.notFound ?? [] }) },
                  )
                }
              >
                {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Assegna {identifiers.length || ""}
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

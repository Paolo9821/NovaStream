import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Plus } from "lucide-react";

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
import { choiceToTerm, defaultTermChoice, TermPicker, type TermChoice } from "@/components/dashboard/TermPicker";
import { useAdminAction } from "@/hooks/useAdminData";
import { formatDate, formatMac, isValidDeviceId, normalizeDeviceId, type LicenseRecord } from "@/lib/api";
import { previewExpiry } from "@/lib/dashboard";

function ExpiryPreview({ value, note }: { value: number | null | undefined; note?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Nuova scadenza</span>
        <span className="font-semibold">
          {value === undefined ? "—" : value === null ? "Nessuna (a vita)" : formatDate(value)}
        </span>
      </div>
      {note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Activates a device by hand: gifts, refunds, payments received outside the site. */
export function GrantDialog({
  token,
  open,
  onOpenChange,
  initialDeviceId = "",
}: {
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDeviceId?: string;
}) {
  const [deviceId, setDeviceId] = useState<string>(initialDeviceId);
  const [label, setLabel] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [choice, setChoice] = useState<TermChoice>(() => defaultTermChoice("12m"));

  useEffect(() => {
    if (open) {
      setDeviceId(initialDeviceId);
      setLabel("");
      setEmail("");
      setChoice(defaultTermChoice("12m"));
    }
  }, [open, initialDeviceId]);

  const term = choiceToTerm(choice);
  const preview = useMemo(() => previewExpiry(term), [term]);
  const grant = useAdminAction(token, ["licenses"], "Licenza attivata");
  const valid = isValidDeviceId(deviceId) && term !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4.5 w-4.5 text-primary" /> Attiva un dispositivo
          </DialogTitle>
          <DialogDescription>Per omaggi, rimborsi o pagamenti ricevuti fuori dal sito.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="grant-device" className="text-sm">
              MAC o ID dispositivo
            </Label>
            <Input
              id="grant-device"
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              placeholder="A4:B1:C2:D3:E4:F5"
              className="mono mt-1.5 h-11 border-border/80 bg-secondary/60 uppercase"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="grant-label" className="text-sm">
                Nome cliente <span className="text-muted-foreground">(facoltativo)</span>
              </Label>
              <Input
                id="grant-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="mt-1.5 h-11 border-border/80 bg-secondary/60"
              />
            </div>
            <div>
              <Label htmlFor="grant-email" className="text-sm">
                Email <span className="text-muted-foreground">(facoltativa)</span>
              </Label>
              <Input
                id="grant-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 h-11 border-border/80 bg-secondary/60"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm">Durata</Label>
            <div className="mt-1.5">
              <TermPicker value={choice} onChange={setChoice} custom="date" />
            </div>
          </div>
          <ExpiryPreview
            value={preview}
            note={
              choice.preset === "date" || choice.preset === "lifetime"
                ? undefined
                : "Se il dispositivo ha già una licenza attiva, il tempo si aggiunge a quello rimasto."
            }
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            disabled={!valid || grant.isPending}
            onClick={() =>
              grant.mutate(
                {
                  path: "/api/admin/grant",
                  body: { deviceId: normalizeDeviceId(deviceId), label, email, term },
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
            className="gap-2"
          >
            {grant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Attiva licenza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Changes how long an existing licence lasts. */
export function EditTermDialog({
  token,
  row,
  onClose,
}: {
  token: string;
  row: LicenseRecord | null;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<TermChoice>(() => defaultTermChoice("1m"));
  useEffect(() => {
    if (row) setChoice(defaultTermChoice("1m"));
  }, [row]);

  const term = choiceToTerm(choice);
  const base = row?.expiresAt && row.expiresAt > Date.now() ? row.expiresAt : Date.now();
  const preview = useMemo(() => previewExpiry(term, base), [term, base]);
  const save = useAdminAction(token, ["licenses"], "Scadenza aggiornata");

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4.5 w-4.5 text-primary" /> Modifica scadenza
          </DialogTitle>
          <DialogDescription>
            <span className="mono">{row ? formatMac(row.deviceId) : ""}</span>
            {row?.label ? ` · ${row.label}` : ""} · scadenza attuale:{" "}
            {row?.expiresAt ? formatDate(row.expiresAt) : "nessuna (a vita)"}
          </DialogDescription>
        </DialogHeader>

        <TermPicker value={choice} onChange={setChoice} custom="date" />
        <ExpiryPreview
          value={preview}
          note={
            choice.preset === "date"
              ? "La licenza scadrà esattamente in questa data."
              : choice.preset === "lifetime"
                ? "La licenza diventa a vita."
                : "Il tempo si aggiunge a quello rimasto (o parte da oggi se è già scaduta)."
          }
        />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button
            disabled={!term || !row || save.isPending}
            onClick={() =>
              row &&
              save.mutate(
                { path: "/api/admin/set-term", body: { deviceId: row.deviceId, term } },
                { onSuccess: onClose },
              )
            }
            className="gap-2"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

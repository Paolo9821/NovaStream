import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, ShieldAlert, ShieldCheck, Smartphone, User } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { post, type SecurityInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Only digits, at most six: what every authenticator app produces. */
const cleanCode = (raw: string): string => raw.replace(/\D/g, "").slice(0, 6);

/** Owner account state plus the two-factor enrolment flow. */
export function SecurityPanel({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [enrolling, setEnrolling] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");
  const [disablePassword, setDisablePassword] = useState<string>("");
  const [disableCode, setDisableCode] = useState<string>("");
  const [disabling, setDisabling] = useState<boolean>(false);

  const security = useQuery({
    queryKey: ["security"],
    queryFn: () => post<SecurityInfo>("/api/admin/security", {}, token),
  });

  const refresh = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: ["security"] });
  }, [queryClient]);

  const setup = useMutation({
    mutationFn: () => post<{ secret: string; otpauth: string }>("/api/admin/2fa/setup", {}, token),
    onSuccess: () => setEnrolling(true),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Impossibile avviare la configurazione"),
  });

  const enable = useMutation({
    mutationFn: () => post<{ ok: boolean }>("/api/admin/2fa/enable", { code }, token),
    onSuccess: () => {
      toast.success("Verifica in due passaggi attiva");
      setEnrolling(false);
      setCode("");
      setup.reset();
      refresh();
    },
    onError: () => toast.error("Codice non valido. Riprova con quello mostrato adesso."),
  });

  const disable = useMutation({
    mutationFn: () =>
      post<{ ok: boolean }>(
        "/api/admin/2fa/disable",
        { password: disablePassword, code: disableCode },
        token,
      ),
    onSuccess: () => {
      toast.success("Verifica in due passaggi disattivata");
      setDisabling(false);
      setDisablePassword("");
      setDisableCode("");
      refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Disattivazione non riuscita"),
  });

  const info = security.data;
  const enabled = info?.twofaEnabled === true;

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              enabled ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning",
            )}
          >
            {enabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold">Sicurezza dell'accesso</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {info?.username ?? "…"}
              </span>
              <span>
                {enabled
                  ? "Verifica in due passaggi attiva"
                  : "Protetto solo da nome utente e password"}
              </span>
            </p>
          </div>
        </div>
        {!enabled && !enrolling && (
          <Button
            onClick={() => setup.mutate()}
            disabled={setup.isPending || security.isLoading}
            className="h-10 gap-2"
          >
            {setup.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            Attiva la verifica in due passaggi
          </Button>
        )}
        {enabled && !disabling && (
          <Button variant="ghost" onClick={() => setDisabling(true)} className="h-10">
            Disattiva
          </Button>
        )}
      </div>

      {info?.usernameConfigured === false && (
        <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Stai usando il nome utente predefinito «admin». Impostane uno personale per rendere
          l'accesso più difficile da indovinare.
        </p>
      )}

      {enrolling && setup.data && (
        <div className="mt-5 grid gap-5 border-t border-border/60 pt-5 sm:grid-cols-[auto_1fr]">
          <div className="mx-auto rounded-2xl bg-white p-3 sm:mx-0">
            <QRCodeSVG value={setup.data.otpauth} size={168} level="M" />
          </div>
          <div>
            <p className="text-sm font-semibold">1. Inquadra il codice con Authy</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Apri Authy sul telefono, tocca «Aggiungi account» e inquadra questo codice. Funziona
              anche con Google Authenticator, Microsoft Authenticator e 1Password.
            </p>
            <p className="mt-3 text-sm font-semibold">Se non puoi inquadrare</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(setup.data.secret);
                toast.success("Chiave copiata");
              }}
              className="mono mt-1 flex items-center gap-2 break-all rounded-lg border border-border/70 px-3 py-2 text-left text-xs"
            >
              {setup.data.secret}
              <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
            <p className="mt-4 text-sm font-semibold">2. Conferma il codice a 6 cifre</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(cleanCode(event.target.value))}
                className="mono h-11 w-36 border-border/80 bg-secondary/60 text-center tracking-[0.3em]"
              />
              <Button
                onClick={() => enable.mutate()}
                disabled={code.length !== 6 || enable.isPending}
                className="h-11 gap-2"
              >
                {enable.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Conferma e attiva
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEnrolling(false);
                  setCode("");
                  setup.reset();
                }}
                className="h-11"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {enabled && disabling && (
        <div className="mt-5 border-t border-border/60 pt-5">
          <p className="text-sm text-muted-foreground">
            Per disattivare la verifica servono la password e un codice valido: così nessuno può
            farlo da una sessione lasciata aperta.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              type="password"
              placeholder="Password"
              value={disablePassword}
              onChange={(event) => setDisablePassword(event.target.value)}
              className="h-11 w-52 border-border/80 bg-secondary/60"
            />
            <Input
              inputMode="numeric"
              placeholder="123456"
              value={disableCode}
              onChange={(event) => setDisableCode(cleanCode(event.target.value))}
              className="mono h-11 w-36 border-border/80 bg-secondary/60 text-center tracking-[0.3em]"
            />
            <Button
              variant="destructive"
              onClick={() => disable.mutate()}
              disabled={disableCode.length !== 6 || !disablePassword || disable.isPending}
              className="h-11 gap-2"
            >
              {disable.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Disattiva
            </Button>
            <Button variant="ghost" onClick={() => setDisabling(false)} className="h-11">
              Annulla
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

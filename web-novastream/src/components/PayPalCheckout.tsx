import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { post, type PlanId } from "@/lib/api";
import { loadPayPal } from "@/lib/paypal";

type CaptureResult = {
  ok: boolean;
  error?: string;
  deviceId?: string;
  plan?: PlanId;
  expiresAt?: number | null;
};

type Props = {
  clientId: string;
  planId: PlanId;
  deviceId: string;
  email: string;
  disabled: boolean;
  onSuccess: (result: CaptureResult) => void;
  onFailure: (message: string) => void;
};

/**
 * Mounts the PayPal smart buttons. The order is created and captured on the
 * Worker so the price and the device binding can never be tampered with here.
 */
export function PayPalCheckout({
  clientId,
  planId,
  deviceId,
  email,
  disabled,
  onSuccess,
  onFailure,
}: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const latest = useRef({ planId, deviceId, email });
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);

  latest.current = { planId, deviceId, email };

  useEffect(() => {
    let cancelled = false;
    let instance: { close: () => void } | null = null;

    loadPayPal(clientId)
      .then((paypal) => {
        if (cancelled || !container.current) return;
        container.current.innerHTML = "";
        const buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "pill", color: "blue", label: "paypal", height: 48 } as unknown as Record<
            string,
            string
          >,
          createOrder: async () => {
            const { planId: plan, deviceId: device } = latest.current;
            const order = await post<{ id: string }>("/api/checkout/create-order", {
              plan,
              deviceId: device,
            });
            return order.id;
          },
          onApprove: async (data) => {
            setProcessing(true);
            try {
              const result = await post<CaptureResult>("/api/checkout/capture", {
                orderId: data.orderID,
                email: latest.current.email,
              });
              if (result.ok) onSuccess(result);
              else onFailure(result.error ?? "Pagamento non completato");
            } catch (error) {
              onFailure(error instanceof Error ? error.message : "Errore durante l'attivazione");
            } finally {
              setProcessing(false);
            }
          },
          onError: (error) => {
            onFailure(error instanceof Error ? error.message : "PayPal ha segnalato un errore");
          },
        });
        instance = buttons;
        buttons
          .render(container.current)
          .then(() => {
            if (!cancelled) setLoading(false);
          })
          .catch(() => {
            if (!cancelled) setLoading(false);
          });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoading(false);
        onFailure(error instanceof Error ? error.message : "PayPal non disponibile");
      });

    return () => {
      cancelled = true;
      try {
        instance?.close();
      } catch {
        /* the SDK throws when the container is already detached */
      }
    };
  }, [clientId, onFailure, onSuccess]);

  return (
    <div className="relative">
      <div
        ref={container}
        className={disabled || processing ? "pointer-events-none opacity-40" : undefined}
      />
      {(loading || processing) && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {processing ? "Attivazione in corso…" : "Carico PayPal…"}
        </div>
      )}
    </div>
  );
}

export type { CaptureResult };

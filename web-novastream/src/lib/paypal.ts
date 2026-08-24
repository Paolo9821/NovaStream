type PayPalButtonsConfig = {
  style?: Record<string, string>;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
};

type PayPalNamespace = {
  Buttons: (config: PayPalButtonsConfig) => {
    render: (target: HTMLElement) => Promise<void>;
    close: () => void;
  };
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

let loader: Promise<PayPalNamespace> | null = null;

/** Loads the PayPal JS SDK once per page, keyed to the merchant client id. */
export function loadPayPal(clientId: string): Promise<PayPalNamespace> {
  if (loader) return loader;
  loader = new Promise<PayPalNamespace>((resolve, reject) => {
    if (window.paypal) {
      resolve(window.paypal);
      return;
    }
    const script = document.createElement("script");
    const params = new URLSearchParams({
      "client-id": clientId,
      currency: "EUR",
      intent: "capture",
      components: "buttons",
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () => {
      if (window.paypal) resolve(window.paypal);
      else reject(new Error("PayPal SDK non disponibile"));
    };
    script.onerror = () => {
      loader = null;
      reject(new Error("Impossibile caricare PayPal"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export type { PayPalButtonsConfig, PayPalNamespace };

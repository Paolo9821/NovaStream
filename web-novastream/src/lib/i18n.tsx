import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { FlagCode } from "@/components/Flag";

export type Lang = "it" | "en" | "es" | "fr" | "de" | "pt" | "ro" | "tr";

export type LanguageInfo = {
  code: Lang;
  /** Written the way a speaker of that language writes it. */
  name: string;
  flag: FlagCode;
  locale: string;
};

export const LANGUAGES: LanguageInfo[] = [
  { code: "it", name: "Italiano", flag: "it", locale: "it-IT" },
  { code: "en", name: "English", flag: "gb", locale: "en-GB" },
  { code: "es", name: "Español", flag: "es", locale: "es-ES" },
  { code: "fr", name: "Français", flag: "fr", locale: "fr-FR" },
  { code: "de", name: "Deutsch", flag: "de", locale: "de-DE" },
  { code: "pt", name: "Português", flag: "pt", locale: "pt-PT" },
  { code: "ro", name: "Română", flag: "ro", locale: "ro-RO" },
  { code: "tr", name: "Türkçe", flag: "tr", locale: "tr-TR" },
];

const it = {
  "nav.manage": "Gestione",
  "hero.badge": "Attivazione automatica, 24 ore su 24",
  "hero.titleA": "Attiva NovaStream",
  "hero.titleB": "in meno di un minuto",
  "hero.sub":
    "Inserisci l'identificativo del tuo dispositivo, paga con carta e riapri l'app: sarà già sbloccata. Nessun codice da digitare, nessuna attesa.",
  "step.device": "Il tuo dispositivo",
  "step.plan": "Scegli la formula",
  "step.payment": "Pagamento",
  "device.label": "Indirizzo MAC o ID dispositivo",
  "device.helpBefore": "Lo trovi nell'app NovaStream in ",
  "device.helpPath": "Impostazioni → Licenza",
  "device.helpAfter": ", oppure nella schermata che compare quando la prova gratuita finisce.",
  "device.invalid": "Controlla il codice: deve essere quello mostrato dall'app.",
  "email.label": "Email",
  "email.optional": "(facoltativa, per la ricevuta)",
  "email.placeholder": "tu@esempio.it",
  "pay.loading": "Carico il negozio…",
  "pay.notConfigured": "Il negozio non è ancora collegato a Stripe. Riprova tra poco.",
  "pay.button": "Paga {price} con carta",
  "pay.buttonGeneric": "Paga con carta",
  "pay.redirecting": "Apro il pagamento sicuro…",
  "pay.hintReady":
    "Prezzo finale, IVA inclusa. Verrai portato sulla pagina sicura di Stripe e poi riportato qui.",
  "pay.hintNoDevice": "Inserisci prima l'identificativo del dispositivo.",
  "pay.testMode": "Modalità test",
  "error.cancelled": "Pagamento annullato. Nessun importo è stato addebitato.",
  "error.confirm": "Non siamo riusciti a confermare il pagamento.",
  "error.confirmFailed": "Verifica del pagamento non riuscita",
  "error.open": "Impossibile aprire il pagamento",
  "total.label": "Totale",
  "total.vat": "IVA inclusa",
  "trust":
    "Il pagamento è gestito da Stripe: carta, Apple Pay e Google Pay. La licenza viene collegata solo al dispositivo che hai indicato e si attiva subito dopo il pagamento.",
  "plan.annual.title": "12 mesi",
  "plan.annual.blurb": "Un anno intero di visione, si rinnova quando vuoi tu.",
  "plan.annual.perk1": "365 giorni di accesso",
  "plan.annual.perk2": "Tutti gli aggiornamenti inclusi",
  "plan.annual.perk3": "Rinnovabile con un clic",
  "plan.lifetime.title": "A vita",
  "plan.lifetime.blurb": "Paghi una volta sola e il dispositivo resta attivo per sempre.",
  "plan.lifetime.perk1": "Nessuna scadenza",
  "plan.lifetime.perk2": "Nessun rinnovo da ricordare",
  "plan.lifetime.perk3": "Il miglior rapporto qualità/prezzo",
  "plan.badge": "Più scelto",
  "plan.perYear": "/ anno",
  "plan.oneTime": "una tantum",
  "how.title": "Come funziona",
  "how.s1.title": "Copia l'identificativo",
  "how.s1.body":
    "Apri NovaStream sul telefono o sulla TV e copia il codice mostrato in Impostazioni → Licenza.",
  "how.s2.title": "Paga con carta",
  "how.s2.body":
    "Scegli 12 mesi o a vita e paga sulla pagina sicura di Stripe. L'attivazione è immediata.",
  "how.s3.title": "Riapri l'app",
  "how.s3.body":
    "Chiudi e riapri NovaStream: si collega al server, riconosce il dispositivo e si sblocca.",
  "check.title": "Verifica una licenza",
  "check.sub": "Hai già pagato e vuoi controllare lo stato del tuo dispositivo?",
  "check.button": "Verifica",
  "check.invalid": "Inserisci un identificativo valido.",
  "check.failed": "Verifica non riuscita",
  "check.activeUntil": "Licenza attiva fino al {date}.",
  "check.activeLifetime": "Licenza a vita attiva.",
  "check.expired": "Licenza scaduta il {date}. Rinnova qui sopra.",
  "check.suspended": "Licenza sospesa. Contatta l'assistenza.",
  "check.revoked": "Licenza revocata.",
  "check.none": "Nessuna licenza per questo dispositivo. Puoi acquistarla qui sopra.",
  "confirm.title": "Confermo il pagamento…",
  "confirm.body": "Un istante: sto attivando la licenza sul tuo dispositivo.",
  "success.title": "Licenza attivata",
  "success.body":
    "Il pagamento è andato a buon fine. Chiudi completamente NovaStream e riaprila: sarà sbloccata su questo dispositivo.",
  "success.device": "Dispositivo",
  "success.plan": "Formula",
  "success.until": "Valida fino al",
  "success.noExpiry": "Nessuna scadenza",
  "success.another": "Attiva un altro dispositivo",
  "lang.title": "Scegli la tua lingua",
  "lang.sub": "Il sito cambia subito e la scelta resta salvata su questo browser.",
  "lang.short": "Lingua",
  "footer": "NovaStream · Assistenza e licenze",
} as const;

export type TranslationKey = keyof typeof it;

type Dictionary = Record<TranslationKey, string>;

const en: Dictionary = {
  "nav.manage": "Management",
  "hero.badge": "Automatic activation, 24 hours a day",
  "hero.titleA": "Activate NovaStream",
  "hero.titleB": "in under a minute",
  "hero.sub":
    "Enter your device identifier, pay by card and reopen the app: it will already be unlocked. No codes to type, no waiting.",
  "step.device": "Your device",
  "step.plan": "Choose your plan",
  "step.payment": "Payment",
  "device.label": "MAC address or device ID",
  "device.helpBefore": "You'll find it in the NovaStream app under ",
  "device.helpPath": "Settings → Licence",
  "device.helpAfter": ", or on the screen that appears when the free trial ends.",
  "device.invalid": "Check the code: it must be the one shown by the app.",
  "email.label": "Email",
  "email.optional": "(optional, for the receipt)",
  "email.placeholder": "you@example.com",
  "pay.loading": "Loading the store…",
  "pay.notConfigured": "The store isn't connected to Stripe yet. Please try again shortly.",
  "pay.button": "Pay {price} by card",
  "pay.buttonGeneric": "Pay by card",
  "pay.redirecting": "Opening secure payment…",
  "pay.hintReady":
    "Final price, VAT included. You'll be taken to Stripe's secure page and brought straight back here.",
  "pay.hintNoDevice": "Enter your device identifier first.",
  "pay.testMode": "Test mode",
  "error.cancelled": "Payment cancelled. Nothing has been charged.",
  "error.confirm": "We couldn't confirm the payment.",
  "error.confirmFailed": "Payment verification failed",
  "error.open": "Couldn't open the payment page",
  "total.label": "Total",
  "total.vat": "VAT included",
  "trust":
    "Payment is handled by Stripe: card, Apple Pay and Google Pay. The licence is tied only to the device you entered and activates right after payment.",
  "plan.annual.title": "12 months",
  "plan.annual.blurb": "A full year of watching, renewed whenever you decide.",
  "plan.annual.perk1": "365 days of access",
  "plan.annual.perk2": "All updates included",
  "plan.annual.perk3": "Renewable in one click",
  "plan.lifetime.title": "Lifetime",
  "plan.lifetime.blurb": "Pay once and the device stays active forever.",
  "plan.lifetime.perk1": "Never expires",
  "plan.lifetime.perk2": "No renewal to remember",
  "plan.lifetime.perk3": "Best value for money",
  "plan.badge": "Most chosen",
  "plan.perYear": "/ year",
  "plan.oneTime": "one-off",
  "how.title": "How it works",
  "how.s1.title": "Copy the identifier",
  "how.s1.body":
    "Open NovaStream on your phone or TV and copy the code shown under Settings → Licence.",
  "how.s2.title": "Pay by card",
  "how.s2.body":
    "Pick 12 months or lifetime and pay on Stripe's secure page. Activation is immediate.",
  "how.s3.title": "Reopen the app",
  "how.s3.body":
    "Close and reopen NovaStream: it reaches the server, recognises the device and unlocks.",
  "check.title": "Check a licence",
  "check.sub": "Already paid and want to check your device status?",
  "check.button": "Check",
  "check.invalid": "Enter a valid identifier.",
  "check.failed": "Check failed",
  "check.activeUntil": "Licence active until {date}.",
  "check.activeLifetime": "Lifetime licence active.",
  "check.expired": "Licence expired on {date}. Renew it above.",
  "check.suspended": "Licence suspended. Please contact support.",
  "check.revoked": "Licence revoked.",
  "check.none": "No licence for this device. You can buy one above.",
  "confirm.title": "Confirming your payment…",
  "confirm.body": "One moment: we're activating the licence on your device.",
  "success.title": "Licence activated",
  "success.body":
    "The payment went through. Fully close NovaStream and reopen it: it will be unlocked on this device.",
  "success.device": "Device",
  "success.plan": "Plan",
  "success.until": "Valid until",
  "success.noExpiry": "Never expires",
  "success.another": "Activate another device",
  "lang.title": "Choose your language",
  "lang.sub": "The site changes right away and your choice stays saved in this browser.",
  "lang.short": "Language",
  "footer": "NovaStream · Support and licences",
};

const es: Dictionary = {
  "nav.manage": "Gestión",
  "hero.badge": "Activación automática, 24 horas al día",
  "hero.titleA": "Activa NovaStream",
  "hero.titleB": "en menos de un minuto",
  "hero.sub":
    "Introduce el identificador de tu dispositivo, paga con tarjeta y vuelve a abrir la app: ya estará desbloqueada. Sin códigos que escribir, sin esperas.",
  "step.device": "Tu dispositivo",
  "step.plan": "Elige tu plan",
  "step.payment": "Pago",
  "device.label": "Dirección MAC o ID del dispositivo",
  "device.helpBefore": "Lo encuentras en la app NovaStream en ",
  "device.helpPath": "Ajustes → Licencia",
  "device.helpAfter": ", o en la pantalla que aparece cuando termina la prueba gratuita.",
  "device.invalid": "Revisa el código: debe ser el que muestra la app.",
  "email.label": "Correo",
  "email.optional": "(opcional, para el recibo)",
  "email.placeholder": "tu@ejemplo.com",
  "pay.loading": "Cargando la tienda…",
  "pay.notConfigured": "La tienda aún no está conectada a Stripe. Inténtalo dentro de un momento.",
  "pay.button": "Paga {price} con tarjeta",
  "pay.buttonGeneric": "Pagar con tarjeta",
  "pay.redirecting": "Abriendo el pago seguro…",
  "pay.hintReady":
    "Precio final, IVA incluido. Te llevaremos a la página segura de Stripe y volverás aquí.",
  "pay.hintNoDevice": "Introduce antes el identificador del dispositivo.",
  "pay.testMode": "Modo de prueba",
  "error.cancelled": "Pago cancelado. No se ha cobrado nada.",
  "error.confirm": "No hemos podido confirmar el pago.",
  "error.confirmFailed": "No se pudo verificar el pago",
  "error.open": "No se pudo abrir el pago",
  "total.label": "Total",
  "total.vat": "IVA incluido",
  "trust":
    "El pago lo gestiona Stripe: tarjeta, Apple Pay y Google Pay. La licencia se vincula solo al dispositivo que has indicado y se activa justo después del pago.",
  "plan.annual.title": "12 meses",
  "plan.annual.blurb": "Un año entero de visionado, se renueva cuando tú quieras.",
  "plan.annual.perk1": "365 días de acceso",
  "plan.annual.perk2": "Todas las actualizaciones incluidas",
  "plan.annual.perk3": "Renovable con un clic",
  "plan.lifetime.title": "De por vida",
  "plan.lifetime.blurb": "Pagas una sola vez y el dispositivo queda activo para siempre.",
  "plan.lifetime.perk1": "Sin caducidad",
  "plan.lifetime.perk2": "Ninguna renovación que recordar",
  "plan.lifetime.perk3": "La mejor relación calidad-precio",
  "plan.badge": "El más elegido",
  "plan.perYear": "/ año",
  "plan.oneTime": "pago único",
  "how.title": "Cómo funciona",
  "how.s1.title": "Copia el identificador",
  "how.s1.body":
    "Abre NovaStream en el móvil o en la TV y copia el código que aparece en Ajustes → Licencia.",
  "how.s2.title": "Paga con tarjeta",
  "how.s2.body":
    "Elige 12 meses o de por vida y paga en la página segura de Stripe. La activación es inmediata.",
  "how.s3.title": "Vuelve a abrir la app",
  "how.s3.body":
    "Cierra y vuelve a abrir NovaStream: se conecta al servidor, reconoce el dispositivo y se desbloquea.",
  "check.title": "Comprueba una licencia",
  "check.sub": "¿Ya has pagado y quieres ver el estado de tu dispositivo?",
  "check.button": "Comprobar",
  "check.invalid": "Introduce un identificador válido.",
  "check.failed": "No se pudo comprobar",
  "check.activeUntil": "Licencia activa hasta el {date}.",
  "check.activeLifetime": "Licencia de por vida activa.",
  "check.expired": "Licencia caducada el {date}. Renuévala arriba.",
  "check.suspended": "Licencia suspendida. Contacta con soporte.",
  "check.revoked": "Licencia revocada.",
  "check.none": "No hay licencia para este dispositivo. Puedes comprarla arriba.",
  "confirm.title": "Confirmando el pago…",
  "confirm.body": "Un momento: estamos activando la licencia en tu dispositivo.",
  "success.title": "Licencia activada",
  "success.body":
    "El pago se ha realizado correctamente. Cierra NovaStream por completo y vuelve a abrirla: estará desbloqueada en este dispositivo.",
  "success.device": "Dispositivo",
  "success.plan": "Plan",
  "success.until": "Válida hasta el",
  "success.noExpiry": "Sin caducidad",
  "success.another": "Activar otro dispositivo",
  "lang.title": "Elige tu idioma",
  "lang.sub": "La web cambia al instante y tu elección se guarda en este navegador.",
  "lang.short": "Idioma",
  "footer": "NovaStream · Soporte y licencias",
};

const fr: Dictionary = {
  "nav.manage": "Gestion",
  "hero.badge": "Activation automatique, 24 h/24",
  "hero.titleA": "Activez NovaStream",
  "hero.titleB": "en moins d'une minute",
  "hero.sub":
    "Saisissez l'identifiant de votre appareil, payez par carte et rouvrez l'application : elle sera déjà débloquée. Aucun code à taper, aucune attente.",
  "step.device": "Votre appareil",
  "step.plan": "Choisissez votre formule",
  "step.payment": "Paiement",
  "device.label": "Adresse MAC ou ID de l'appareil",
  "device.helpBefore": "Vous le trouverez dans l'application NovaStream sous ",
  "device.helpPath": "Réglages → Licence",
  "device.helpAfter": ", ou sur l'écran qui apparaît à la fin de l'essai gratuit.",
  "device.invalid": "Vérifiez le code : il doit correspondre à celui affiché par l'application.",
  "email.label": "E-mail",
  "email.optional": "(facultatif, pour le reçu)",
  "email.placeholder": "vous@exemple.fr",
  "pay.loading": "Chargement de la boutique…",
  "pay.notConfigured": "La boutique n'est pas encore reliée à Stripe. Réessayez dans un instant.",
  "pay.button": "Payer {price} par carte",
  "pay.buttonGeneric": "Payer par carte",
  "pay.redirecting": "Ouverture du paiement sécurisé…",
  "pay.hintReady":
    "Prix final, TVA incluse. Vous serez dirigé vers la page sécurisée de Stripe puis ramené ici.",
  "pay.hintNoDevice": "Saisissez d'abord l'identifiant de l'appareil.",
  "pay.testMode": "Mode test",
  "error.cancelled": "Paiement annulé. Aucun montant n'a été débité.",
  "error.confirm": "Nous n'avons pas pu confirmer le paiement.",
  "error.confirmFailed": "Échec de la vérification du paiement",
  "error.open": "Impossible d'ouvrir le paiement",
  "total.label": "Total",
  "total.vat": "TVA incluse",
  "trust":
    "Le paiement est géré par Stripe : carte, Apple Pay et Google Pay. La licence est liée uniquement à l'appareil indiqué et s'active juste après le paiement.",
  "plan.annual.title": "12 mois",
  "plan.annual.blurb": "Une année entière de visionnage, renouvelée quand vous le décidez.",
  "plan.annual.perk1": "365 jours d'accès",
  "plan.annual.perk2": "Toutes les mises à jour incluses",
  "plan.annual.perk3": "Renouvelable en un clic",
  "plan.lifetime.title": "À vie",
  "plan.lifetime.blurb": "Vous payez une seule fois et l'appareil reste actif pour toujours.",
  "plan.lifetime.perk1": "Aucune expiration",
  "plan.lifetime.perk2": "Aucun renouvellement à retenir",
  "plan.lifetime.perk3": "Le meilleur rapport qualité-prix",
  "plan.badge": "Le plus choisi",
  "plan.perYear": "/ an",
  "plan.oneTime": "paiement unique",
  "how.title": "Comment ça marche",
  "how.s1.title": "Copiez l'identifiant",
  "how.s1.body":
    "Ouvrez NovaStream sur votre téléphone ou votre TV et copiez le code affiché dans Réglages → Licence.",
  "how.s2.title": "Payez par carte",
  "how.s2.body":
    "Choisissez 12 mois ou à vie et payez sur la page sécurisée de Stripe. L'activation est immédiate.",
  "how.s3.title": "Rouvrez l'application",
  "how.s3.body":
    "Fermez puis rouvrez NovaStream : elle contacte le serveur, reconnaît l'appareil et se débloque.",
  "check.title": "Vérifier une licence",
  "check.sub": "Vous avez déjà payé et souhaitez connaître l'état de votre appareil ?",
  "check.button": "Vérifier",
  "check.invalid": "Saisissez un identifiant valide.",
  "check.failed": "Vérification impossible",
  "check.activeUntil": "Licence active jusqu'au {date}.",
  "check.activeLifetime": "Licence à vie active.",
  "check.expired": "Licence expirée le {date}. Renouvelez-la ci-dessus.",
  "check.suspended": "Licence suspendue. Contactez l'assistance.",
  "check.revoked": "Licence révoquée.",
  "check.none": "Aucune licence pour cet appareil. Vous pouvez l'acheter ci-dessus.",
  "confirm.title": "Confirmation du paiement…",
  "confirm.body": "Un instant : nous activons la licence sur votre appareil.",
  "success.title": "Licence activée",
  "success.body":
    "Le paiement a bien été effectué. Fermez complètement NovaStream puis rouvrez-la : elle sera débloquée sur cet appareil.",
  "success.device": "Appareil",
  "success.plan": "Formule",
  "success.until": "Valable jusqu'au",
  "success.noExpiry": "Aucune expiration",
  "success.another": "Activer un autre appareil",
  "lang.title": "Choisissez votre langue",
  "lang.sub": "Le site change aussitôt et votre choix reste enregistré dans ce navigateur.",
  "lang.short": "Langue",
  "footer": "NovaStream · Assistance et licences",
};

const de: Dictionary = {
  "nav.manage": "Verwaltung",
  "hero.badge": "Automatische Freischaltung, rund um die Uhr",
  "hero.titleA": "NovaStream freischalten",
  "hero.titleB": "in weniger als einer Minute",
  "hero.sub":
    "Gerätekennung eingeben, per Karte bezahlen und die App neu öffnen: Sie ist bereits freigeschaltet. Kein Code zum Eintippen, kein Warten.",
  "step.device": "Ihr Gerät",
  "step.plan": "Tarif wählen",
  "step.payment": "Zahlung",
  "device.label": "MAC-Adresse oder Geräte-ID",
  "device.helpBefore": "Sie finden sie in der NovaStream-App unter ",
  "device.helpPath": "Einstellungen → Lizenz",
  "device.helpAfter": " oder auf dem Bildschirm, der nach Ablauf der kostenlosen Testphase erscheint.",
  "device.invalid": "Prüfen Sie den Code: Er muss dem in der App angezeigten entsprechen.",
  "email.label": "E-Mail",
  "email.optional": "(optional, für den Beleg)",
  "email.placeholder": "sie@beispiel.de",
  "pay.loading": "Shop wird geladen…",
  "pay.notConfigured": "Der Shop ist noch nicht mit Stripe verbunden. Bitte gleich erneut versuchen.",
  "pay.button": "{price} per Karte zahlen",
  "pay.buttonGeneric": "Mit Karte zahlen",
  "pay.redirecting": "Sichere Zahlung wird geöffnet…",
  "pay.hintReady":
    "Endpreis inkl. MwSt. Sie gelangen zur sicheren Seite von Stripe und kommen danach hierher zurück.",
  "pay.hintNoDevice": "Geben Sie zuerst die Gerätekennung ein.",
  "pay.testMode": "Testmodus",
  "error.cancelled": "Zahlung abgebrochen. Es wurde nichts abgebucht.",
  "error.confirm": "Wir konnten die Zahlung nicht bestätigen.",
  "error.confirmFailed": "Zahlungsprüfung fehlgeschlagen",
  "error.open": "Zahlung konnte nicht geöffnet werden",
  "total.label": "Gesamt",
  "total.vat": "inkl. MwSt.",
  "trust":
    "Die Zahlung wickelt Stripe ab: Karte, Apple Pay und Google Pay. Die Lizenz gilt nur für das angegebene Gerät und wird direkt nach der Zahlung aktiv.",
  "plan.annual.title": "12 Monate",
  "plan.annual.blurb": "Ein ganzes Jahr schauen, Verlängerung wann Sie möchten.",
  "plan.annual.perk1": "365 Tage Zugang",
  "plan.annual.perk2": "Alle Updates inbegriffen",
  "plan.annual.perk3": "Verlängerung mit einem Klick",
  "plan.lifetime.title": "Lebenslang",
  "plan.lifetime.blurb": "Einmal zahlen und das Gerät bleibt für immer aktiv.",
  "plan.lifetime.perk1": "Läuft nie ab",
  "plan.lifetime.perk2": "Keine Verlängerung im Kopf behalten",
  "plan.lifetime.perk3": "Das beste Preis-Leistungs-Verhältnis",
  "plan.badge": "Am beliebtesten",
  "plan.perYear": "/ Jahr",
  "plan.oneTime": "einmalig",
  "how.title": "So funktioniert es",
  "how.s1.title": "Kennung kopieren",
  "how.s1.body":
    "Öffnen Sie NovaStream auf dem Handy oder Fernseher und kopieren Sie den Code unter Einstellungen → Lizenz.",
  "how.s2.title": "Per Karte zahlen",
  "how.s2.body":
    "Wählen Sie 12 Monate oder lebenslang und zahlen Sie auf der sicheren Stripe-Seite. Die Freischaltung erfolgt sofort.",
  "how.s3.title": "App neu öffnen",
  "how.s3.body":
    "Schließen und öffnen Sie NovaStream erneut: Sie verbindet sich mit dem Server, erkennt das Gerät und schaltet frei.",
  "check.title": "Lizenz prüfen",
  "check.sub": "Schon bezahlt und möchten den Status Ihres Geräts sehen?",
  "check.button": "Prüfen",
  "check.invalid": "Geben Sie eine gültige Kennung ein.",
  "check.failed": "Prüfung fehlgeschlagen",
  "check.activeUntil": "Lizenz aktiv bis {date}.",
  "check.activeLifetime": "Lebenslange Lizenz aktiv.",
  "check.expired": "Lizenz am {date} abgelaufen. Oben verlängern.",
  "check.suspended": "Lizenz gesperrt. Bitte den Support kontaktieren.",
  "check.revoked": "Lizenz widerrufen.",
  "check.none": "Keine Lizenz für dieses Gerät. Oben können Sie eine kaufen.",
  "confirm.title": "Zahlung wird bestätigt…",
  "confirm.body": "Einen Moment: Wir schalten die Lizenz auf Ihrem Gerät frei.",
  "success.title": "Lizenz aktiviert",
  "success.body":
    "Die Zahlung war erfolgreich. Schließen Sie NovaStream vollständig und öffnen Sie die App erneut: Sie ist auf diesem Gerät freigeschaltet.",
  "success.device": "Gerät",
  "success.plan": "Tarif",
  "success.until": "Gültig bis",
  "success.noExpiry": "Läuft nie ab",
  "success.another": "Weiteres Gerät freischalten",
  "lang.title": "Wählen Sie Ihre Sprache",
  "lang.sub": "Die Seite wechselt sofort und Ihre Wahl bleibt in diesem Browser gespeichert.",
  "lang.short": "Sprache",
  "footer": "NovaStream · Support und Lizenzen",
};

const pt: Dictionary = {
  "nav.manage": "Gestão",
  "hero.badge": "Ativação automática, 24 horas por dia",
  "hero.titleA": "Ative o NovaStream",
  "hero.titleB": "em menos de um minuto",
  "hero.sub":
    "Introduza o identificador do seu dispositivo, pague com cartão e volte a abrir a aplicação: já estará desbloqueada. Sem códigos para escrever, sem esperas.",
  "step.device": "O seu dispositivo",
  "step.plan": "Escolha o plano",
  "step.payment": "Pagamento",
  "device.label": "Endereço MAC ou ID do dispositivo",
  "device.helpBefore": "Encontra-o na aplicação NovaStream em ",
  "device.helpPath": "Definições → Licença",
  "device.helpAfter": ", ou no ecrã que aparece quando termina a versão de experiência gratuita.",
  "device.invalid": "Verifique o código: tem de ser o que a aplicação mostra.",
  "email.label": "E-mail",
  "email.optional": "(opcional, para o recibo)",
  "email.placeholder": "voce@exemplo.pt",
  "pay.loading": "A carregar a loja…",
  "pay.notConfigured": "A loja ainda não está ligada ao Stripe. Tente novamente dentro de momentos.",
  "pay.button": "Pagar {price} com cartão",
  "pay.buttonGeneric": "Pagar com cartão",
  "pay.redirecting": "A abrir o pagamento seguro…",
  "pay.hintReady":
    "Preço final, IVA incluído. Vai para a página segura do Stripe e regressa logo a seguir.",
  "pay.hintNoDevice": "Introduza primeiro o identificador do dispositivo.",
  "pay.testMode": "Modo de teste",
  "error.cancelled": "Pagamento cancelado. Não foi cobrado nenhum valor.",
  "error.confirm": "Não conseguimos confirmar o pagamento.",
  "error.confirmFailed": "Falha ao verificar o pagamento",
  "error.open": "Não foi possível abrir o pagamento",
  "total.label": "Total",
  "total.vat": "IVA incluído",
  "trust":
    "O pagamento é tratado pelo Stripe: cartão, Apple Pay e Google Pay. A licença fica ligada apenas ao dispositivo indicado e ativa-se logo após o pagamento.",
  "plan.annual.title": "12 meses",
  "plan.annual.blurb": "Um ano inteiro a ver, renova quando quiser.",
  "plan.annual.perk1": "365 dias de acesso",
  "plan.annual.perk2": "Todas as atualizações incluídas",
  "plan.annual.perk3": "Renovável com um clique",
  "plan.lifetime.title": "Vitalícia",
  "plan.lifetime.blurb": "Paga uma só vez e o dispositivo fica ativo para sempre.",
  "plan.lifetime.perk1": "Nunca expira",
  "plan.lifetime.perk2": "Nenhuma renovação para lembrar",
  "plan.lifetime.perk3": "A melhor relação qualidade/preço",
  "plan.badge": "O mais escolhido",
  "plan.perYear": "/ ano",
  "plan.oneTime": "pagamento único",
  "how.title": "Como funciona",
  "how.s1.title": "Copie o identificador",
  "how.s1.body":
    "Abra o NovaStream no telemóvel ou na TV e copie o código mostrado em Definições → Licença.",
  "how.s2.title": "Pague com cartão",
  "how.s2.body":
    "Escolha 12 meses ou vitalícia e pague na página segura do Stripe. A ativação é imediata.",
  "how.s3.title": "Volte a abrir a aplicação",
  "how.s3.body":
    "Feche e abra o NovaStream: liga-se ao servidor, reconhece o dispositivo e desbloqueia.",
  "check.title": "Verificar uma licença",
  "check.sub": "Já pagou e quer ver o estado do seu dispositivo?",
  "check.button": "Verificar",
  "check.invalid": "Introduza um identificador válido.",
  "check.failed": "Não foi possível verificar",
  "check.activeUntil": "Licença ativa até {date}.",
  "check.activeLifetime": "Licença vitalícia ativa.",
  "check.expired": "Licença expirada a {date}. Renove aqui em cima.",
  "check.suspended": "Licença suspensa. Contacte a assistência.",
  "check.revoked": "Licença revogada.",
  "check.none": "Não há licença para este dispositivo. Pode comprá-la aqui em cima.",
  "confirm.title": "A confirmar o pagamento…",
  "confirm.body": "Um instante: estamos a ativar a licença no seu dispositivo.",
  "success.title": "Licença ativada",
  "success.body":
    "O pagamento foi concluído. Feche completamente o NovaStream e volte a abri-lo: estará desbloqueado neste dispositivo.",
  "success.device": "Dispositivo",
  "success.plan": "Plano",
  "success.until": "Válida até",
  "success.noExpiry": "Nunca expira",
  "success.another": "Ativar outro dispositivo",
  "lang.title": "Escolha o seu idioma",
  "lang.sub": "O site muda de imediato e a sua escolha fica guardada neste navegador.",
  "lang.short": "Idioma",
  "footer": "NovaStream · Assistência e licenças",
};

const ro: Dictionary = {
  "nav.manage": "Administrare",
  "hero.badge": "Activare automată, 24 de ore din 24",
  "hero.titleA": "Activează NovaStream",
  "hero.titleB": "în mai puțin de un minut",
  "hero.sub":
    "Introdu identificatorul dispozitivului, plătește cu cardul și redeschide aplicația: va fi deja deblocată. Fără coduri de tastat, fără așteptare.",
  "step.device": "Dispozitivul tău",
  "step.plan": "Alege planul",
  "step.payment": "Plată",
  "device.label": "Adresa MAC sau ID-ul dispozitivului",
  "device.helpBefore": "Îl găsești în aplicația NovaStream la ",
  "device.helpPath": "Setări → Licență",
  "device.helpAfter": ", sau pe ecranul care apare când se termină perioada gratuită.",
  "device.invalid": "Verifică codul: trebuie să fie cel afișat de aplicație.",
  "email.label": "E-mail",
  "email.optional": "(opțional, pentru chitanță)",
  "email.placeholder": "tu@exemplu.ro",
  "pay.loading": "Se încarcă magazinul…",
  "pay.notConfigured": "Magazinul nu este încă legat la Stripe. Încearcă din nou în scurt timp.",
  "pay.button": "Plătește {price} cu cardul",
  "pay.buttonGeneric": "Plătește cu cardul",
  "pay.redirecting": "Se deschide plata securizată…",
  "pay.hintReady":
    "Preț final, TVA inclus. Vei ajunge pe pagina securizată Stripe și apoi vei reveni aici.",
  "pay.hintNoDevice": "Introdu mai întâi identificatorul dispozitivului.",
  "pay.testMode": "Mod de test",
  "error.cancelled": "Plată anulată. Nu s-a reținut nicio sumă.",
  "error.confirm": "Nu am putut confirma plata.",
  "error.confirmFailed": "Verificarea plății a eșuat",
  "error.open": "Nu am putut deschide plata",
  "total.label": "Total",
  "total.vat": "TVA inclus",
  "trust":
    "Plata este gestionată de Stripe: card, Apple Pay și Google Pay. Licența este legată doar de dispozitivul indicat și se activează imediat după plată.",
  "plan.annual.title": "12 luni",
  "plan.annual.blurb": "Un an întreg de vizionare, se reînnoiește când vrei tu.",
  "plan.annual.perk1": "365 de zile de acces",
  "plan.annual.perk2": "Toate actualizările incluse",
  "plan.annual.perk3": "Reînnoire dintr-un clic",
  "plan.lifetime.title": "Pe viață",
  "plan.lifetime.blurb": "Plătești o singură dată, iar dispozitivul rămâne activ pentru totdeauna.",
  "plan.lifetime.perk1": "Fără expirare",
  "plan.lifetime.perk2": "Nicio reînnoire de ținut minte",
  "plan.lifetime.perk3": "Cel mai bun raport calitate-preț",
  "plan.badge": "Cel mai ales",
  "plan.perYear": "/ an",
  "plan.oneTime": "plată unică",
  "how.title": "Cum funcționează",
  "how.s1.title": "Copiază identificatorul",
  "how.s1.body":
    "Deschide NovaStream pe telefon sau pe televizor și copiază codul afișat la Setări → Licență.",
  "how.s2.title": "Plătește cu cardul",
  "how.s2.body":
    "Alege 12 luni sau pe viață și plătește pe pagina securizată Stripe. Activarea este imediată.",
  "how.s3.title": "Redeschide aplicația",
  "how.s3.body":
    "Închide și redeschide NovaStream: se conectează la server, recunoaște dispozitivul și se deblochează.",
  "check.title": "Verifică o licență",
  "check.sub": "Ai plătit deja și vrei să vezi starea dispozitivului tău?",
  "check.button": "Verifică",
  "check.invalid": "Introdu un identificator valid.",
  "check.failed": "Verificarea nu a reușit",
  "check.activeUntil": "Licență activă până la {date}.",
  "check.activeLifetime": "Licență pe viață activă.",
  "check.expired": "Licență expirată la {date}. Reînnoiește mai sus.",
  "check.suspended": "Licență suspendată. Contactează asistența.",
  "check.revoked": "Licență revocată.",
  "check.none": "Nicio licență pentru acest dispozitiv. O poți cumpăra mai sus.",
  "confirm.title": "Se confirmă plata…",
  "confirm.body": "O clipă: activăm licența pe dispozitivul tău.",
  "success.title": "Licență activată",
  "success.body":
    "Plata a reușit. Închide complet NovaStream și redeschide-o: va fi deblocată pe acest dispozitiv.",
  "success.device": "Dispozitiv",
  "success.plan": "Plan",
  "success.until": "Valabilă până la",
  "success.noExpiry": "Fără expirare",
  "success.another": "Activează alt dispozitiv",
  "lang.title": "Alege limba",
  "lang.sub": "Site-ul se schimbă imediat, iar alegerea rămâne salvată în acest browser.",
  "lang.short": "Limba",
  "footer": "NovaStream · Asistență și licențe",
};

const tr: Dictionary = {
  "nav.manage": "Yönetim",
  "hero.badge": "Otomatik etkinleştirme, günün 24 saati",
  "hero.titleA": "NovaStream'i etkinleştir",
  "hero.titleB": "bir dakikadan kısa sürede",
  "hero.sub":
    "Cihaz kimliğinizi girin, kartla ödeyin ve uygulamayı yeniden açın: kilidi çoktan açılmış olacak. Yazılacak kod yok, bekleme yok.",
  "step.device": "Cihazınız",
  "step.plan": "Planınızı seçin",
  "step.payment": "Ödeme",
  "device.label": "MAC adresi veya cihaz kimliği",
  "device.helpBefore": "NovaStream uygulamasında ",
  "device.helpPath": "Ayarlar → Lisans",
  "device.helpAfter":
    " bölümünde ya da ücretsiz deneme bittiğinde çıkan ekranda bulabilirsiniz.",
  "device.invalid": "Kodu kontrol edin: uygulamanın gösterdiği kod olmalı.",
  "email.label": "E-posta",
  "email.optional": "(isteğe bağlı, makbuz için)",
  "email.placeholder": "siz@ornek.com",
  "pay.loading": "Mağaza yükleniyor…",
  "pay.notConfigured": "Mağaza henüz Stripe'a bağlı değil. Birazdan tekrar deneyin.",
  "pay.button": "{price} kartla öde",
  "pay.buttonGeneric": "Kartla öde",
  "pay.redirecting": "Güvenli ödeme açılıyor…",
  "pay.hintReady":
    "Nihai fiyat, KDV dahil. Stripe'ın güvenli sayfasına gidip hemen buraya döneceksiniz.",
  "pay.hintNoDevice": "Önce cihaz kimliğini girin.",
  "pay.testMode": "Test modu",
  "error.cancelled": "Ödeme iptal edildi. Hiçbir tutar tahsil edilmedi.",
  "error.confirm": "Ödemeyi doğrulayamadık.",
  "error.confirmFailed": "Ödeme doğrulaması başarısız",
  "error.open": "Ödeme sayfası açılamadı",
  "total.label": "Toplam",
  "total.vat": "KDV dahil",
  "trust":
    "Ödemeyi Stripe yönetir: kart, Apple Pay ve Google Pay. Lisans yalnızca girdiğiniz cihaza bağlanır ve ödemeden hemen sonra etkinleşir.",
  "plan.annual.title": "12 ay",
  "plan.annual.blurb": "Tam bir yıl izleme, yenilemeye siz karar verirsiniz.",
  "plan.annual.perk1": "365 gün erişim",
  "plan.annual.perk2": "Tüm güncellemeler dahil",
  "plan.annual.perk3": "Tek tıkla yenilenir",
  "plan.lifetime.title": "Ömür boyu",
  "plan.lifetime.blurb": "Bir kez ödersiniz, cihaz sonsuza dek etkin kalır.",
  "plan.lifetime.perk1": "Süresi hiç dolmaz",
  "plan.lifetime.perk2": "Hatırlanacak yenileme yok",
  "plan.lifetime.perk3": "En iyi fiyat/performans",
  "plan.badge": "En çok seçilen",
  "plan.perYear": "/ yıl",
  "plan.oneTime": "tek seferlik",
  "how.title": "Nasıl çalışır",
  "how.s1.title": "Kimliği kopyalayın",
  "how.s1.body":
    "Telefonunuzda veya televizyonunuzda NovaStream'i açın ve Ayarlar → Lisans bölümündeki kodu kopyalayın.",
  "how.s2.title": "Kartla ödeyin",
  "how.s2.body":
    "12 ay veya ömür boyu seçin ve Stripe'ın güvenli sayfasında ödeyin. Etkinleştirme anındadır.",
  "how.s3.title": "Uygulamayı yeniden açın",
  "how.s3.body":
    "NovaStream'i kapatıp yeniden açın: sunucuya bağlanır, cihazı tanır ve kilidi açılır.",
  "check.title": "Lisans sorgula",
  "check.sub": "Ödemeyi yaptınız ve cihazınızın durumunu mu görmek istiyorsunuz?",
  "check.button": "Sorgula",
  "check.invalid": "Geçerli bir kimlik girin.",
  "check.failed": "Sorgulama başarısız",
  "check.activeUntil": "Lisans {date} tarihine kadar etkin.",
  "check.activeLifetime": "Ömür boyu lisans etkin.",
  "check.expired": "Lisans {date} tarihinde doldu. Yukarıdan yenileyin.",
  "check.suspended": "Lisans askıya alındı. Lütfen destekle iletişime geçin.",
  "check.revoked": "Lisans iptal edildi.",
  "check.none": "Bu cihaz için lisans yok. Yukarıdan satın alabilirsiniz.",
  "confirm.title": "Ödeme doğrulanıyor…",
  "confirm.body": "Bir saniye: lisansı cihazınızda etkinleştiriyoruz.",
  "success.title": "Lisans etkinleştirildi",
  "success.body":
    "Ödeme başarıyla tamamlandı. NovaStream'i tamamen kapatıp yeniden açın: bu cihazda kilidi açılmış olacak.",
  "success.device": "Cihaz",
  "success.plan": "Plan",
  "success.until": "Şu tarihe kadar geçerli",
  "success.noExpiry": "Süresi dolmaz",
  "success.another": "Başka bir cihaz etkinleştir",
  "lang.title": "Dilinizi seçin",
  "lang.sub": "Site hemen değişir ve seçiminiz bu tarayıcıda kayıtlı kalır.",
  "lang.short": "Dil",
  "footer": "NovaStream · Destek ve lisanslar",
};

const DICTIONARIES: Record<Lang, Dictionary> = { it, en, es, fr, de, pt, ro, tr };

const STORAGE_KEY = "novastream_lang";

const isLang = (value: string): value is Lang =>
  LANGUAGES.some((entry) => entry.code === value);

/** Saved choice first, then the browser's own language, then Italian. */
function detectLanguage(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && isLang(saved)) return saved;
  for (const candidate of navigator.languages ?? [navigator.language]) {
    const base = candidate.slice(0, 2).toLowerCase();
    if (isLang(base)) return base;
  }
  return "it";
}

type I18nValue = {
  lang: Lang;
  locale: string;
  setLang: (next: Lang) => void;
  /** Looks up a key and fills `{name}` placeholders. */
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLanguage);

  const setLang = useCallback((next: Lang): void => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const dictionary = DICTIONARIES[lang];
    return {
      lang,
      locale: LANGUAGES.find((entry) => entry.code === lang)?.locale ?? "it-IT",
      setLang,
      t: (key, vars) => {
        const raw = dictionary[key] ?? it[key];
        if (!vars) return raw;
        return Object.entries(vars).reduce(
          (text, [name, replacement]) => text.split(`{${name}}`).join(replacement),
          raw,
        );
      },
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside LanguageProvider");
  return value;
}

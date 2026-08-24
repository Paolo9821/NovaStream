import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, LifeBuoy, ShieldCheck, Zap } from "lucide-react";

import { LanguagePicker } from "@/components/LanguagePicker";
import { useI18n } from "@/lib/i18n";

/**
 * Legal wording is kept in English on every locale: it is the same text the
 * Android app shows, so there is a single binding version of what was agreed.
 */
type Section = { heading: string; body: string[]; list?: string[] };

const LAST_UPDATED = "2026-08-24";

const CONTACT_LINE =
  "The fastest way to reach us is the support form on this site; every request lands directly in our management console.";

const TERMS: Section[] = [
  {
    heading: "1. Who these terms are between",
    body: [
      "These Terms of Service govern your use of the NovaStream application and of this website, where licences for the application are sold. By installing the application, by continuing to use it after the free trial, or by purchasing a licence, you accept these terms.",
      "If you do not accept them, do not purchase a licence and remove the application from your device.",
    ],
  },
  {
    heading: "2. What NovaStream is",
    body: [
      "NovaStream is a media player. It plays audio and video streams from playlists and sources that you, the user, provide and configure yourself.",
      "We do not supply, host, resell, aggregate, index or control any channel, film, series, playlist or other content. No content of any kind is included in the price of a licence. You are solely responsible for the sources you add and for holding the rights or authorisations required to access them in your country.",
    ],
  },
  {
    heading: "3. The licence you are buying",
    body: [
      "A licence unlocks the features of the application on one single device. It is bound to the device identifier shown inside the application (the network hardware address where readable, otherwise the identifier assigned by the operating system).",
      "A licence is personal and non-transferable. It is not a subscription to any content service, it does not renew automatically, and no amount is ever charged again unless you deliberately buy another period.",
    ],
    list: [
      "12 months: the application stays unlocked on that device for 365 days from activation. Buying again before expiry adds a further 365 days on top of the time you still have.",
      "Lifetime: a one-off payment that keeps that device unlocked for as long as the application and the licence service remain available.",
    ],
  },
  {
    heading: "4. Free trial — please test before you buy",
    body: [
      "Every device gets a free trial of 7 days with the full feature set and no payment details required. We strongly encourage you to use it.",
      "The trial exists so that you can check, on your own device, your own network and your own sources, that the application works the way you expect before spending any money. Please make sure that video playback, your playlists and the general behaviour of the application satisfy you during the trial period. Buying a licence means the trial has satisfied you.",
    ],
  },
  {
    heading: "5. Prices, payment and invoicing",
    body: [
      "Prices are shown on this site in euro and are final: the advertised amount is what you pay, VAT included where applicable.",
      "Payments are processed by Stripe. We never see or store your card details. Activation happens automatically as soon as Stripe confirms the payment, normally within seconds and at any hour of the day.",
    ],
  },
  {
    heading: "6. No refunds",
    body: [
      "All sales are final. Licences are not refundable, in whole or in part, and this applies to both the 12-month and the lifetime licence. We do not offer refunds for change of mind, for accidental purchases, for a device you no longer use, for time left unused on a licence, or because a third-party source or playlist you added has stopped working.",
      "This is exactly why the 7-day free trial exists, and why we ask you to test the application on your own device before you buy. Once the trial has convinced you, the purchase is a deliberate decision on your part.",
      "By completing a purchase you expressly request that the licence be delivered and activated immediately, and you acknowledge that, digital content being supplied at once, the statutory right of withdrawal for distance contracts is lost upon that delivery.",
      "Nothing in this section limits any right you may have under mandatory consumer law where the product is genuinely defective. If the application itself fails to work on a supported device because of a fault on our side, contact us through the support form: we will fix the problem, or extend or reissue the licence.",
    ],
  },
  {
    heading: "7. How you may use the application",
    body: ["When using NovaStream you agree not to:"],
    list: [
      "share, resell, sublicense or publish your licence, or attempt to use it on devices other than the one it is bound to;",
      "tamper with the application, its licence checks or the licence service, or attempt to obtain access without paying;",
      "use the application to access, distribute or make available content you have no right to;",
      "use the application for any purpose that is unlawful in your country.",
    ],
  },
  {
    heading: "8. Suspension and revocation",
    body: [
      "We may suspend or revoke a licence, without refund, if we detect fraud, a payment reversal or chargeback, licence sharing, tampering with the licence system, or any breach of section 7. Where the circumstances allow it, we will tell you why and give you the opportunity to explain.",
    ],
  },
  {
    heading: "9. Availability and offline behaviour",
    body: [
      "The application checks its licence with our service when it starts. A paid device that cannot reach the network keeps working offline for up to 14 days, so a connection problem never turns into a lost evening.",
      "We aim to keep the licence service available at all times, but we cannot guarantee uninterrupted operation. Playback quality depends on your internet connection, on your device and on the sources you have configured, none of which are under our control.",
    ],
  },
  {
    heading: "10. Support",
    body: [
      CONTACT_LINE,
      "Please include the device identifier shown in the application: it lets us find your licence immediately and answer you in one reply instead of three.",
    ],
  },
  {
    heading: "11. Liability",
    body: [
      "The application is provided as it is. To the maximum extent permitted by law, our total liability towards you for any claim connected with the application or with a licence is limited to the amount you actually paid for that licence.",
      "We are not liable for content accessed through sources you configure, nor for any loss arising from the unavailability of such sources.",
    ],
  },
  {
    heading: "12. Changes to these terms",
    body: [
      "We may update these terms, for example when features change or when the law requires it. The date at the top of this page always shows the current version. Changes are not retroactive and never turn a licence you already own into a paid one twice.",
    ],
  },
  {
    heading: "13. Governing law",
    body: [
      "These terms are governed by Italian law. Mandatory consumer protection rules of the country where you habitually reside continue to apply to you.",
    ],
  },
];

const PRIVACY: Section[] = [
  {
    heading: "1. The short version",
    body: [
      "We keep the least amount of data that still lets a licence work: which device is entitled to use the application, and how to reach you if you write to us. There is no advertising, no profiling, no data broker, no sale of anything to anyone.",
    ],
  },
  {
    heading: "2. What we store",
    body: ["Depending on what you do, our licence registry may hold:"],
    list: [
      "the device identifier of the device a licence is bound to (network hardware address or the identifier assigned by the operating system);",
      "the email address you optionally provide at checkout, used for the receipt and to reach you about that licence;",
      "the plan purchased, the amount paid, the payment reference returned by Stripe and the expiry date;",
      "the date and time of the last licence check made by the device, so we can tell an active device from an abandoned one;",
      "the content of any support request you send us: your email address, the device identifier you type in, the topic, your message and the language of the site at that moment.",
    ],
  },
  {
    heading: "3. What we never store",
    body: [
      "We do not record what you watch. Playlists, sources, channel names, viewing history, favourites and playback positions stay on your device and are never sent to us.",
      "We do not use advertising networks, tracking pixels or third-party analytics on this site, and the application contains no advertising SDK.",
      "We never see your card number, expiry date or security code. Those are handled entirely by Stripe.",
    ],
  },
  {
    heading: "4. Why we are allowed to hold it",
    body: [
      "Licence data is processed to perform the contract you entered into when buying a licence, and to comply with our accounting obligations. Support requests are processed on the basis of our legitimate interest in answering the people who write to us, and in your interest in receiving an answer.",
    ],
  },
  {
    heading: "5. Who else is involved",
    body: [
      "Stripe Payments Europe processes payments and holds the payment data connected with your purchase, under its own privacy policy. Cloudflare hosts this site and the licence service, and stores the registry data on our behalf. No one else receives your data, and it is never sold, rented or used for marketing by third parties.",
    ],
  },
  {
    heading: "6. How long we keep it",
    body: [
      "Licence records are kept while the licence exists and for as long as accounting rules require afterwards. Support requests are kept while we work on them and for a reasonable period after they are closed; the oldest ones are automatically discarded so the inbox cannot grow indefinitely.",
    ],
  },
  {
    heading: "7. Your rights",
    body: [
      "You can ask us what we hold about you, ask for it to be corrected, or ask for it to be deleted. Deleting a licence record also removes the entitlement it carries, so a deletion request for an active licence ends the licence.",
      CONTACT_LINE,
      "You also have the right to lodge a complaint with your national data protection authority.",
    ],
  },
  {
    heading: "8. Children",
    body: [
      "NovaStream is not directed at children and we do not knowingly collect data from anyone under 16.",
    ],
  },
  {
    heading: "9. Changes to this policy",
    body: [
      "If this policy changes, the date at the top of the page changes with it. Material changes will also be reflected inside the application.",
    ],
  },
];

function LegalPage({
  icon,
  title,
  sections,
}: {
  icon: ReactNode;
  title: string;
  sections: Section[];
}) {
  const { t, locale } = useI18n();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const updated = new Date(LAST_UPDATED).toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-veil" aria-hidden />

      <header className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Zap className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">NovaStream</span>
        </Link>
        <LanguagePicker />
      </header>

      <main className="relative mx-auto max-w-3xl px-5 pb-24">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Link>

        <div className="animate-rise mt-6 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary glow-ring">
            {icon}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("legal.updated", { date: updated })}
            </p>
          </div>
        </div>

        <p className="mt-5 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {t("legal.english")}
        </p>

        <article className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-bold text-foreground">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-2.5 text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-3 space-y-2">
                  {section.list.map((item) => (
                    <li
                      key={item.slice(0, 40)}
                      className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        <LegalFooterNav />
      </main>
    </div>
  );
}

function LegalFooterNav() {
  const { t } = useI18n();
  return (
    <nav className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-6 text-xs text-muted-foreground">
      <Link to="/termini" className="transition hover:text-foreground">
        {t("legal.terms.title")}
      </Link>
      <Link to="/privacy" className="transition hover:text-foreground">
        {t("legal.privacy.title")}
      </Link>
      <Link to="/assistenza" className="flex items-center gap-1.5 transition hover:text-foreground">
        <LifeBuoy className="h-3.5 w-3.5" />
        {t("footer.support")}
      </Link>
    </nav>
  );
}

export function TermsPage() {
  const { t } = useI18n();
  return <LegalPage icon={<FileText className="h-5 w-5" />} title={t("legal.terms.title")} sections={TERMS} />;
}

export function PrivacyPage() {
  const { t } = useI18n();
  return (
    <LegalPage icon={<ShieldCheck className="h-5 w-5" />} title={t("legal.privacy.title")} sections={PRIVACY} />
  );
}

/**
 * Outgoing email through Resend (https://resend.com). Nothing here is
 * required for the site to work: without a key the call is simply skipped,
 * and a failed send never stops the caller.
 */
export type MailEnv = {
  RESEND_API_KEY?: string;
  /** Sender shown to the recipient; must belong to a domain verified on Resend. */
  SUPPORT_FROM_EMAIL?: string;
  /** Inbox that receives the support requests. */
  SUPPORT_INBOX?: string;
};

export const DEFAULT_SUPPORT_INBOX = "support@novastreamapp.com";
const DEFAULT_FROM = "NovaStream <support@novastreamapp.com>";

export type MailResult = { sent: boolean; skipped?: boolean; error?: string };

export const mailConfigured = (env: MailEnv): boolean => Boolean(env.RESEND_API_KEY?.trim());

export async function sendMail(
  env: MailEnv,
  message: { to: string; subject: string; text: string; html?: string; replyTo?: string },
): Promise<MailResult> {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return { sent: false, skipped: true };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.SUPPORT_FROM_EMAIL?.trim() || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      console.warn("mail not sent", response.status, detail);
      return { sent: false, error: `resend ${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.warn("mail not sent", reason);
    return { sent: false, error: reason };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

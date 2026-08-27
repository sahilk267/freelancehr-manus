import nodemailer from "nodemailer";

export const EMAIL_PURPOSES = ["owner", "clients", "talent", "interviews", "finance", "privacy"] as const;
export type EmailPurpose = (typeof EMAIL_PURPOSES)[number];

const approvedDomain = (process.env.SMTP_FROM_DOMAIN || "overseasjob.in").trim().toLowerCase();

export function isApprovedSenderAddress(address: string) {
  const normalized = address.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.endsWith(`@${approvedDomain}`);
}

export function detectOptOut(text: string) {
  return /\b(stop|unsubscribe|do not contact|remove me|don't contact|dont contact)\b/i.test(text);
}

export function getSmtpStatus() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  return { configured: Boolean(host && port && user && password), hostConfigured: Boolean(host), portConfigured: Boolean(port), userConfigured: Boolean(user), passwordConfigured: Boolean(password) };
}

function createTransport() {
  return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
}

export async function verifySmtpTransport() {
  const config = getSmtpStatus();
  if (!config.configured) return { ok: false, status: "credentials_missing" as const };
  try {
    await createTransport().verify();
    return { ok: true, status: "verified" as const };
  } catch {
    return { ok: false, status: "connection_failed" as const };
  }
}

export async function sendApprovedEmail(input: { from: string; to: string; replyTo?: string | null; subject: string; text: string }) {
  if (!isApprovedSenderAddress(input.from)) throw new Error("The selected sender is not in the approved domain allowlist.");
  const config = getSmtpStatus();
  if (!config.configured) throw new Error("SMTP is not configured. Add the Hostinger mailbox credentials before enabling live send.");
  const result = await createTransport().sendMail({ from: input.from, to: input.to, replyTo: input.replyTo || undefined, subject: input.subject, text: input.text, headers: { "X-FreelanceHR-Controlled": "true" } });
  return { providerMessageId: result.messageId };
}

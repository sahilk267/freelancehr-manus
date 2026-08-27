import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export type InboundMessage = { providerMessageId: string; inReplyTo?: string; references: string[]; from: string; subject?: string; text: string };

export function getInboundMailStatus() {
  const host = process.env.IMAP_HOST?.trim();
  const port = Number(process.env.IMAP_PORT || 0);
  const user = process.env.IMAP_USER?.trim();
  const password = process.env.IMAP_PASSWORD;
  return { configured: Boolean(host && port && user && password), hostConfigured: Boolean(host), portConfigured: Boolean(port), userConfigured: Boolean(user), passwordConfigured: Boolean(password) };
}

export function chooseThreadReference(input: Pick<InboundMessage, "inReplyTo" | "references">) {
  return input.inReplyTo?.trim() || input.references.find(Boolean)?.trim() || null;
}

export async function normalizeInboundSource(source: Buffer): Promise<InboundMessage> {
  const parsed = await simpleParser(source);
  const from = parsed.from?.value[0]?.address?.trim().toLowerCase();
  if (!from || !parsed.messageId) throw new Error("Inbound email is missing a sender or provider message ID.");
  const references = (Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : []).map(value => String(value).trim()).filter(Boolean);
  return { providerMessageId: parsed.messageId.trim(), inReplyTo: parsed.inReplyTo?.trim(), references, from, subject: parsed.subject?.trim() || undefined, text: (parsed.text || "").trim() };
}

export async function verifyInboundMailTransport() {
  const status = getInboundMailStatus();
  if (!status.configured) return { ok: false, status: "credentials_missing" as const };
  const client = new ImapFlow({ host: process.env.IMAP_HOST!, port: Number(process.env.IMAP_PORT), secure: Number(process.env.IMAP_PORT) === 993, auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASSWORD! }, logger: false });
  try {
    await client.connect();
    return { ok: true, status: "verified" as const };
  } catch {
    return { ok: false, status: "connection_failed" as const };
  } finally {
    if (client.usable) await client.logout().catch(() => undefined);
  }
}

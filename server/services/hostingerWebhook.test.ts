import { afterEach, describe, expect, it } from "vitest";
import { isValidHostingerWebhookAuthorization, normalizeHostingerMailEvent } from "./hostingerWebhook";

describe("Hostinger Mail API webhook safeguards", () => {
  const environment = { ...process.env };
  afterEach(() => { process.env = { ...environment }; });

  it("accepts only the configured bearer token", () => {
    process.env.HOSTINGER_MAIL_WEBHOOK_SECRET = "webhook-secret";
    expect(isValidHostingerWebhookAuthorization("Bearer webhook-secret")).toBe(true);
    expect(isValidHostingerWebhookAuthorization("Bearer incorrect-secret")).toBe(false);
    expect(isValidHostingerWebhookAuthorization(undefined)).toBe(false);
  });

  it("normalizes a Hostinger received-message event into a safe intake payload", () => {
    expect(normalizeHostingerMailEvent({ event: "message.received", data: { message: { id: "provider-1", from: "candidate@example.test", subject: "Re: Role", text: "I am interested", inReplyTo: "<previous@example.test>", references: ["<previous@example.test>"] } } })).toMatchObject({ providerMessageId: "provider-1", sender: "candidate@example.test", inReplyTo: "<previous@example.test>", event: "message.received" });
  });

  it("rejects malformed provider events before they can enter a recruitment workflow", () => {
    expect(normalizeHostingerMailEvent({ event: "message.received", data: { message: { id: "provider-1" } } })).toBeNull();
  });
});

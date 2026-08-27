import { afterEach, describe, expect, it, vi } from "vitest";
import { detectOptOut, getSmtpStatus, isApprovedSenderAddress, verifySmtpTransport } from "./email";

describe("email safety helpers", () => {
  const environment = { ...process.env };
  afterEach(() => { process.env = { ...environment }; vi.resetModules(); });

  it("allows only approved-domain sender identities", () => {
    expect(isApprovedSenderAddress("clients@overseasjob.in")).toBe(true);
    expect(isApprovedSenderAddress("clients@another-domain.test")).toBe(false);
    expect(isApprovedSenderAddress("not-an-email")).toBe(false);
  });

  it("detects candidate and client opt-out language before further contact", () => {
    expect(detectOptOut("Please unsubscribe me from all future hiring messages.")).toBe(true);
    expect(detectOptOut("Thank you, let us schedule a call next week.")).toBe(false);
  });

  it("reports SMTP as unavailable until all server credentials are configured", () => {
    delete process.env.SMTP_HOST; delete process.env.SMTP_PORT; delete process.env.SMTP_USER; delete process.env.SMTP_PASSWORD;
    expect(getSmtpStatus().configured).toBe(false);
  });

  it("fails a real SMTP verification safely when credentials are absent", async () => {
    delete process.env.SMTP_HOST; delete process.env.SMTP_PORT; delete process.env.SMTP_USER; delete process.env.SMTP_PASSWORD;
    await expect(verifySmtpTransport()).resolves.toEqual({ ok: false, status: "credentials_missing" });
  });
});

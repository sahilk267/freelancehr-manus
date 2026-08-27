import { afterEach, describe, expect, it } from "vitest";
import { chooseThreadReference, detectOptOut, getHostingerMailApiStatus, isApprovedSenderAddress, verifyHostingerMailApi } from "./hostingerMail";

describe("Hostinger Mail API safeguards", () => {
  const environment = { ...process.env };
  afterEach(() => { process.env = { ...environment }; });

  it("allows only configured-domain sender identities", () => {
    expect(isApprovedSenderAddress("clients@overseasjob.in")).toBe(true);
    expect(isApprovedSenderAddress("clients@another-domain.test")).toBe(false);
  });

  it("keeps the API integration disabled when no bearer token is configured", () => {
    delete process.env.HOSTINGER_MAIL_API_TOKEN;
    expect(getHostingerMailApiStatus().configured).toBe(false);
  });

  it("fails API verification safely when bearer credentials are absent", async () => {
    delete process.env.HOSTINGER_MAIL_API_TOKEN;
    await expect(verifyHostingerMailApi()).resolves.toEqual({ ok: false, status: "credentials_missing" });
  });

  it("correlates the immediate reply reference before older thread references", () => {
    expect(chooseThreadReference({ inReplyTo: "<reply@example.test>", references: ["<parent@example.test>"] })).toBe("<reply@example.test>");
  });

  it("detects opt-out language before a follow-up can be scheduled", () => {
    expect(detectOptOut("Please unsubscribe and do not contact me again.")).toBe(true);
    expect(detectOptOut("Thank you, I can take a call tomorrow.")).toBe(false);
  });
});

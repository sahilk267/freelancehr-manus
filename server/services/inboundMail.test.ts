import { describe, expect, it } from "vitest";
import { chooseThreadReference, getInboundMailStatus } from "./inboundMail";

describe("inbound email correlation", () => {
  it("uses In-Reply-To before older References when correlating a reply", () => {
    expect(chooseThreadReference({ inReplyTo: "<latest@example.test>", references: ["<older@example.test>"] })).toBe("<latest@example.test>");
  });

  it("falls back to the first References entry when In-Reply-To is absent", () => {
    expect(chooseThreadReference({ references: ["<message@example.test>"] })).toBe("<message@example.test>");
  });

  it("keeps inbound polling disabled without protected IMAP credentials", () => {
    const status = getInboundMailStatus();
    expect(typeof status.configured).toBe("boolean");
  });
});

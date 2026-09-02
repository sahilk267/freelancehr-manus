import { describe, expect, it } from "vitest";
import { isPrimaryOwner } from "./workspaceAccess";

describe("configured primary owner environment", () => {
  it("recognizes the configured owner email", () => {
    expect(process.env.PRIMARY_OWNER_EMAIL).toBe("owner.fl@overseasjob.in");
    expect(isPrimaryOwner({ openId: "oidc-owner", email: "owner.fl@overseasjob.in" })).toBe(true);
  });
});

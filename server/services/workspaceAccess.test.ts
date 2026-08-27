import { beforeEach, describe, expect, it, vi } from "vitest";

let selectResults: unknown[][] = [];

vi.mock("../db", () => ({
  requireDb: async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => selectResults.shift() ?? [] }) }) }),
  }),
}));

const { canAccessWorkspacePath, requestedWorkspaceId, resolveWorkspaceAccess } = await import("./workspaceAccess");

describe("workspace team access", () => {
  beforeEach(() => { selectResults = []; });

  it("keeps the signed-in user's own workspace as the default", async () => {
    await expect(resolveWorkspaceAccess({ id: 17 } as never, null)).resolves.toEqual({ ownerId: 17, role: "owner", isOwner: true, memberId: null });
  });

  it("resolves only a current active membership for an explicitly selected workspace", async () => {
    selectResults = [[{ id: "tm-1", ownerId: 44, memberUserId: 17, role: "finance", status: "active" }]];
    await expect(resolveWorkspaceAccess({ id: 17 } as never, 44)).resolves.toEqual({ ownerId: 44, role: "finance", isOwner: false, memberId: "tm-1" });
  });

  it("does not expose a requested workspace when no active membership exists", async () => {
    selectResults = [[]];
    await expect(resolveWorkspaceAccess({ id: 17 } as never, 44)).resolves.toEqual({ ownerId: 17, role: "owner", isOwner: true, memberId: null });
  });

  it("accepts only a bounded numeric active-workspace request header", () => {
    expect(requestedWorkspaceId({ headers: { "x-freelancehr-workspace": "44" } })).toBe(44);
    expect(requestedWorkspaceId({ headers: { "x-freelancehr-workspace": "44 or 1=1" } })).toBeNull();
    expect(requestedWorkspaceId({ headers: { "x-freelancehr-workspace": "0" } })).toBeNull();
  });

  it("permits recruiter preparation work but blocks client sharing and email delivery", () => {
    const access = { ownerId: 44, role: "recruiter" as const, isOwner: false, memberId: "tm-1" };
    expect(canAccessWorkspacePath(access, "recruitment.jobs.create")).toBe(true);
    expect(canAccessWorkspacePath(access, "recruitment.matching.requestShareApproval")).toBe(false);
    expect(canAccessWorkspacePath(access, "email.outbound.deliverApproved")).toBe(false);
  });

  it("permits coordinator interview operations but blocks finance and approvals", () => {
    const access = { ownerId: 44, role: "coordinator" as const, isOwner: false, memberId: "tm-1" };
    expect(canAccessWorkspacePath(access, "recruitment.interviews.create")).toBe(true);
    expect(canAccessWorkspacePath(access, "recruitment.invoices.draft")).toBe(false);
    expect(canAccessWorkspacePath(access, "recruitment.approvals.decide")).toBe(false);
  });

  it("permits finance invoice preparation but blocks issue approval and external sends", () => {
    const access = { ownerId: 44, role: "finance" as const, isOwner: false, memberId: "tm-1" };
    expect(canAccessWorkspacePath(access, "recruitment.invoices.draft")).toBe(true);
    expect(canAccessWorkspacePath(access, "recruitment.invoices.requestIssueApproval")).toBe(false);
    expect(canAccessWorkspacePath(access, "email.outbound.requestApproval")).toBe(false);
  });

  it("keeps the viewer read-only", () => {
    const access = { ownerId: 44, role: "viewer" as const, isOwner: false, memberId: "tm-1" };
    expect(canAccessWorkspacePath(access, "recruitment.candidates.list")).toBe(true);
    expect(canAccessWorkspacePath(access, "recruitment.candidates.create")).toBe(false);
    expect(canAccessWorkspacePath(access, "team.myAccess")).toBe(true);
  });

  it("allows the owner full workspace control", () => {
    expect(canAccessWorkspacePath({ ownerId: 17, role: "owner", isOwner: true, memberId: null }, "consequential.decide")).toBe(true);
  });
});

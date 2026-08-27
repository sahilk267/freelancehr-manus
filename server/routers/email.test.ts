import { beforeEach, describe, expect, it, vi } from "vitest";

const inserts: Record<string, unknown>[] = [];
const audits: Record<string, unknown>[] = [];
let selectResults: unknown[][] = [];

vi.mock("../../drizzle/schema", () => ({ approvals: {}, conversations: {}, emailIdentities: {}, incidents: {}, messages: {}, suppressionList: {} }));
vi.mock("../db", () => ({
  createId: (prefix = "") => `${prefix}unit-id`,
  hashContactValue: (value: string) => `hash:${value}`,
  recordAudit: async (entry: Record<string, unknown>) => { audits.push(entry); },
  requireDb: async () => ({
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => selectResults.shift() ?? [] }), limit: async () => selectResults.shift() ?? [] }) }) }),
    insert: () => ({ values: async (values: Record<string, unknown>) => { inserts.push(values); return undefined; } }),
  }),
}));

const { emailRouter } = await import("./email");
const ctx = { user: { id: 17, role: "admin" }, req: {}, res: {} } as never;

describe("email router controlled evidence", () => {
  beforeEach(() => { inserts.length = 0; audits.length = 0; selectResults = []; });

  it("creates an approval-gated outbound message when sender is active and recipient is not suppressed", async () => {
    selectResults = [[{ id: "identity-1", status: "active", email: "clients@overseasjob.in" }], []];
    const caller = emailRouter.createCaller(ctx);
    const result = await caller.outbound.requestApproval({ conversationId: "conversation-1", senderIdentityId: "identity-1", recipient: "person@example.test", subject: "Role", body: "A controlled outreach message." });
    expect(result).toMatchObject({ messageId: "msg_unit-id", approvalId: "apr_unit-id" });
    expect(inserts).toHaveLength(2);
    expect(inserts[0]).toMatchObject({ status: "approval_pending", direction: "outbound" });
    expect(inserts[1]).toMatchObject({ actionType: "email_send", status: "pending" });
    expect(audits.some(entry => entry.action === "email.send_approval_requested")).toBe(true);
  });

  it("blocks suppressed recipients before an email approval or message record is created", async () => {
    selectResults = [[{ id: "identity-1", status: "active", email: "clients@overseasjob.in" }], [{ active: true }]];
    const caller = emailRouter.createCaller(ctx);
    await expect(caller.outbound.requestApproval({ conversationId: "conversation-1", senderIdentityId: "identity-1", recipient: "stop@example.test", subject: "Role", body: "A controlled outreach message." })).rejects.toThrow("Recipient is suppressed");
    expect(inserts).toHaveLength(0);
  });

  it("returns approval and linked message context only through owner-scoped detail retrieval", async () => {
    selectResults = [[{ id: "approval-1", resourceId: "message-1", status: "pending", actionType: "email_send", reason: "Owner review", payload: { recipient: "person@example.test" } }], [{ id: "message-1", conversationId: "conversation-1", subject: "Role" }], [{ id: "conversation-1", channel: "email" }]];
    const caller = emailRouter.createCaller(ctx);
    const detail = await caller.outbound.approvalDetail({ approvalId: "approval-1" });
    expect(detail).toMatchObject({ approval: { payload: { recipient: "person@example.test" } }, message: { id: "message-1" }, conversation: { id: "conversation-1" } });
  });

  it("returns message history only after the requested conversation is resolved in the owner workspace", async () => {
    selectResults = [[{ id: "conversation-1", ownerId: 17 }], [{ id: "message-1", conversationId: "conversation-1", direction: "inbound", status: "received", subject: "Re: Role" }]];
    const caller = emailRouter.createCaller(ctx);
    await expect(caller.inbound.messages({ conversationId: "conversation-1", limit: 20 })).resolves.toMatchObject([{ id: "message-1", conversationId: "conversation-1" }]);
  });

  it("rejects delivery before a current approved email action exists", async () => {
    selectResults = [[{ id: "message-1", ownerId: 17, status: "approval_pending", subject: "Role", body: "A controlled email" }], [{ id: "identity-1", ownerId: 17, status: "active", purpose: "clients", displayName: "FreelanceHR" }], []];
    const caller = emailRouter.createCaller(ctx);
    await expect(caller.outbound.deliverApproved({ messageId: "message-1", senderIdentityId: "identity-1", recipient: "person@example.test" })).rejects.toThrow("approved email action");
  });
});

import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { candidates, rightsRequests, screenings, shortlists } from "../../drizzle/schema";
import { createId, recordAudit, requireDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { assertTransition } from "../workflow";

export const candidateWorkflowsRouter = router({
  screenings: router({
    list: protectedProcedure.input(z.object({ jobId: z.string().min(4).optional(), candidateId: z.string().min(4).optional(), limit: z.number().int().min(1).max(100).default(50) }).default({ limit: 50 })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const filters = [eq(screenings.ownerId, ctx.user.id)];
      if (input.jobId) filters.push(eq(screenings.jobId, input.jobId));
      if (input.candidateId) filters.push(eq(screenings.candidateId, input.candidateId));
      return db.select().from(screenings).where(and(...filters)).orderBy(desc(screenings.updatedAt)).limit(input.limit);
    }),
    create: protectedProcedure.input(z.object({ candidateId: z.string().min(4), jobId: z.string().min(4), answers: z.record(z.string(), z.unknown()), evidence: z.array(z.string().trim().min(2).max(500)).max(20).default([]), confidence: z.number().int().min(0).max(100).default(0) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const id = createId("scr_");
      await db.insert(screenings).values({ id, ownerId: ctx.user.id, candidateId: input.candidateId, jobId: input.jobId, status: "in_progress", answers: input.answers, evidence: input.evidence, confidence: input.confidence });
      await recordAudit({ ownerId: ctx.user.id, actorType: "user", actorId: String(ctx.user.id), action: "screening.created", resourceType: "screening", resourceId: id, nextState: "in_progress" });
      return { id };
    }),
    updateState: protectedProcedure.input(z.object({ id: z.string().min(4), status: z.enum(["in_progress", "evidence_pending", "ready_for_owner_decision", "closed"]) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const record = (await db.select().from(screenings).where(and(eq(screenings.id, input.id), eq(screenings.ownerId, ctx.user.id))).limit(1))[0];
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Screening was not found." });
      assertTransition("screening", record.status, input.status);
      await db.update(screenings).set({ status: input.status }).where(eq(screenings.id, record.id));
      await recordAudit({ ownerId: ctx.user.id, actorType: "user", actorId: String(ctx.user.id), action: "screening.state_changed", resourceType: "screening", resourceId: record.id, previousState: record.status, nextState: input.status });
      return { success: true };
    }),
  }),
  shortlists: router({
    list: protectedProcedure.input(z.object({ jobId: z.string().min(4).optional(), limit: z.number().int().min(1).max(100).default(50) }).default({ limit: 50 })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const filters = [eq(shortlists.ownerId, ctx.user.id)];
      if (input.jobId) filters.push(eq(shortlists.jobId, input.jobId));
      return db.select().from(shortlists).where(and(...filters)).orderBy(desc(shortlists.createdAt)).limit(input.limit);
    }),
    updateNote: protectedProcedure.input(z.object({ id: z.string().min(4), clientFeedback: z.string().trim().max(4000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const shortlist = (await db.select().from(shortlists).where(and(eq(shortlists.id, input.id), eq(shortlists.ownerId, ctx.user.id))).limit(1))[0];
      if (!shortlist) throw new TRPCError({ code: "NOT_FOUND", message: "Shortlist was not found." });
      if (shortlist.status === "shared") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A shared shortlist cannot be altered; prepare a new controlled share instead." });
      await db.update(shortlists).set({ clientFeedback: input.clientFeedback }).where(eq(shortlists.id, shortlist.id));
      await recordAudit({ ownerId: ctx.user.id, actorType: "user", actorId: String(ctx.user.id), action: "shortlist.feedback_updated", resourceType: "shortlist", resourceId: shortlist.id });
      return { success: true };
    }),
    updateState: protectedProcedure.input(z.object({ id: z.string().min(4), status: z.enum(["approval_pending", "shared", "viewed", "withdrawn", "expired"]) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const shortlist = (await db.select().from(shortlists).where(and(eq(shortlists.id, input.id), eq(shortlists.ownerId, ctx.user.id))).limit(1))[0];
      if (!shortlist) throw new TRPCError({ code: "NOT_FOUND", message: "Shortlist was not found." });
      assertTransition("shortlist", shortlist.status, input.status);
      await db.update(shortlists).set({ status: input.status }).where(eq(shortlists.id, shortlist.id));
      await recordAudit({ ownerId: ctx.user.id, actorType: "user", actorId: String(ctx.user.id), action: "shortlist.state_changed", resourceType: "shortlist", resourceId: shortlist.id, previousState: shortlist.status, nextState: input.status });
      return { success: true };
    }),
  }),
  privacy: router({
    pendingRights: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(rightsRequests).where(and(eq(rightsRequests.ownerId, ctx.user.id), eq(rightsRequests.status, "received"))).orderBy(desc(rightsRequests.receivedAt));
    }),
    fulfillCorrection: protectedProcedure.input(z.object({ requestId: z.string().min(4), fullName: z.string().trim().min(2).max(160).optional(), headline: z.string().trim().max(255).optional(), location: z.string().trim().max(160).optional(), availability: z.string().trim().max(120).optional(), resolutionNote: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const request = (await db.select().from(rightsRequests).where(and(eq(rightsRequests.id, input.requestId), eq(rightsRequests.ownerId, ctx.user.id))).limit(1))[0];
      if (!request || request.requestType !== "correction" || request.status !== "received") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An open correction request is required." });
      assertTransition("rights_request", request.status, "resolved");
      const patch = { ...(input.fullName ? { fullName: input.fullName } : {}), ...(input.headline ? { headline: input.headline } : {}), ...(input.location ? { location: input.location } : {}), ...(input.availability ? { availability: input.availability } : {}) };
      if (!Object.keys(patch).length) throw new TRPCError({ code: "BAD_REQUEST", message: "Provide at least one corrected profile field." });
      await db.update(candidates).set(patch).where(and(eq(candidates.id, request.candidateId), eq(candidates.ownerId, ctx.user.id)));
      await db.update(rightsRequests).set({ status: "resolved", resolvedAt: new Date(), details: `${request.details}\nResolution: ${input.resolutionNote}` }).where(eq(rightsRequests.id, request.id));
      await recordAudit({ ownerId: ctx.user.id, actorType: "user", actorId: String(ctx.user.id), action: "privacy.correction_fulfilled", resourceType: "rights_request", resourceId: request.id, previousState: "received", nextState: "resolved", metadata: { candidateId: request.candidateId } });
      return { success: true };
    }),
    fulfillDeletion: protectedProcedure.input(z.object({ requestId: z.string().min(4), resolutionNote: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const request = (await db.select().from(rightsRequests).where(and(eq(rightsRequests.id, input.requestId), eq(rightsRequests.ownerId, ctx.user.id))).limit(1))[0];
      if (!request || request.requestType !== "deletion" || request.status !== "received") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An open deletion request is required." });
      assertTransition("rights_request", request.status, "resolved");
      await db.update(candidates).set({ fullName: "Deleted candidate", email: null, emailHash: null, phone: null, phoneHash: null, headline: null, location: null, availability: null, profileState: "deleted", deletedAt: new Date() }).where(and(eq(candidates.id, request.candidateId), eq(candidates.ownerId, ctx.user.id)));
      await db.update(rightsRequests).set({ status: "resolved", resolvedAt: new Date(), details: `${request.details}\nResolution: ${input.resolutionNote}` }).where(eq(rightsRequests.id, request.id));
      await recordAudit({ ownerId: ctx.user.id, actorType: "user", actorId: String(ctx.user.id), action: "privacy.deletion_fulfilled", resourceType: "rights_request", resourceId: request.id, previousState: "received", nextState: "resolved", metadata: { candidateId: request.candidateId, piiRedacted: true } });
      return { success: true };
    }),
  }),
});

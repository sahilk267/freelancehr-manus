import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { assertTransition, ensureSafeAiText, isConsequentialAction } from "./workflow";

describe("recruitment workflow controls", () => {
  it("allows valid job-state progression", () => {
    expect(() => assertTransition("job", "draft", "client_confirmation")).not.toThrow();
    expect(() => assertTransition("job", "approved", "sourcing")).not.toThrow();
  });

  it("blocks an unsafe workflow jump", () => {
    expect(() => assertTransition("job", "draft", "filled")).toThrow(TRPCError);
  });

  it("marks client sharing, onboarding, placements, and invoices as consequential", () => {
    expect(isConsequentialAction("client_onboarding")).toBe(true);
    expect(isConsequentialAction("candidate_share")).toBe(true);
    expect(isConsequentialAction("placement_confirmation")).toBe(true);
    expect(isConsequentialAction("invoice_issue")).toBe(true);
    expect(isConsequentialAction("draft_outreach")).toBe(false);
  });

  it("rejects protected or prohibited prompts in recruitment AI workflows", () => {
    expect(() => ensureSafeAiText("Rank candidates by religion")).toThrow(TRPCError);
    expect(() => ensureSafeAiText("Summarize evidence of TypeScript experience")).not.toThrow();
  });
});

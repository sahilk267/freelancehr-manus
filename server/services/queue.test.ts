import { describe, expect, it } from "vitest";
import { withinDailyAiBudget } from "./queue";

describe("daily AI budget guard", () => {
  it("allows a request below the configured daily limit and blocks it at the limit", () => {
    expect(withinDailyAiBudget(44, 45)).toBe(true);
    expect(withinDailyAiBudget(45, 45)).toBe(false);
  });
});

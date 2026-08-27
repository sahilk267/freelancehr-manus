import { describe, expect, it } from "vitest";

describe("OpenRouter credential", () => {
  it("authenticates with the configured server-side API key", async () => {
    const key = process.env.OPENROUTER_API_KEY;
    expect(key, "OPENROUTER_API_KEY must be available to the server test process").toBeTruthy();

    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}` },
    });

    expect(response.ok, `OpenRouter authentication failed with HTTP ${response.status}`).toBe(true);
    const payload = await response.json() as { data?: { limit?: number | null } };
    expect(payload.data).toBeTruthy();
  }, 20_000);
});

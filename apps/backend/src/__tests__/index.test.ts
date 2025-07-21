import { describe, expect, it } from "vitest";
import app from "../index";
import type { ApiInfoResponse } from "../types/api";

describe("Hono Backend", () => {
  it("should return API info for GET /", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiInfoResponse;
    expect(data.message).toBe("x402 Learning Lab API");
    expect(data.version).toBe("1.0.0");
  });
});

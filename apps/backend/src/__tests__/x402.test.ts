import { describe, expect, it } from "vitest";
import app from "../index";
import type { ApiInfoResponse, X402ErrorResponse } from "../types/api";

describe("x402 Payment Protocol Integration", () => {
  describe("Free Endpoints", () => {
    it("should return API info for GET /", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);

      const data = (await res.json()) as ApiInfoResponse;
      expect(data.message).toBe("x402 Learning Lab API");
      expect(data.version).toBe("1.0.0");
      expect(data.endpoints.free).toContain("/");
      expect(data.endpoints.protected).toContain("/protected/demo");
    });
  });

  describe("Protected Endpoints (x402)", () => {
    it("should return HTTP 402 Payment Required for /protected/demo without payment", async () => {
      const res = await app.request("/protected/demo");

      // x402プロトコルではHTTP 402ステータスコードが返される
      expect(res.status).toBe(402);

      // x402は JSON形式で支払い情報を返す
      expect(res.headers.get("content-type")).toContain("application/json");

      const data = (await res.json()) as X402ErrorResponse;
      expect(data.error).toBe("X-PAYMENT header is required");
      expect(data.accepts).toBeDefined();
      expect(Array.isArray(data.accepts)).toBe(true);
    });

    it("should return HTTP 402 Payment Required for /protected/weather without payment", async () => {
      const res = await app.request("/protected/weather");

      expect(res.status).toBe(402);
      expect(res.headers.get("content-type")).toContain("application/json");

      const data = (await res.json()) as X402ErrorResponse;
      expect(data.error).toBe("X-PAYMENT header is required");
    });

    it("should include x402 payment information in response body", async () => {
      const res = await app.request("/protected/demo");

      expect(res.status).toBe(402);

      const data = (await res.json()) as X402ErrorResponse;
      expect(data.accepts).toBeDefined();
      expect(data.accepts.length).toBeGreaterThan(0);

      const paymentInfo = data.accepts[0];

      // Base Sepoliaネットワークと価格設定を確認
      expect(paymentInfo.network).toBe("base-sepolia");
      expect(paymentInfo.maxAmountRequired).toBe("10000"); // $0.01 in smallest units
      expect(paymentInfo.description).toBe("Access to premium API content");
      expect(paymentInfo.asset).toBe(
        "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      ); // USDC contract
    });
  });

  describe("x402 Configuration", () => {
    it("should handle wildcard route protection correctly", async () => {
      // /protected/* パターンにマッチする任意のパスをテスト
      const paths = [
        "/protected/demo",
        "/protected/weather",
        "/protected/any-path",
      ];

      for (const path of paths) {
        const res = await app.request(path);
        expect(res.status).toBe(402);
      }
    });

    it("should not protect non-matching routes", async () => {
      // /protected/ にマッチしないパスは保護されない
      const res = await app.request("/");
      expect(res.status).toBe(200);
    });
  });
});

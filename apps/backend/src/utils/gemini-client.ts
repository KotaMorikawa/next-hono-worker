import type { NaturalLanguageInput } from "@repo/shared/api";
import type { GeneratedApiSpec } from "../services/llm-service";

export class GeminiClient {
  async generateCode(input: NaturalLanguageInput): Promise<GeneratedApiSpec> {
    // 実際の実装では、Gemini Pro APIを呼び出します
    // 現在はテスト用のモック実装

    // 複雑度に応じた価格設定
    const priceMapping = {
      simple: "0.01",
      medium: "0.05",
      complex: "0.10",
    };

    // メソッドの推定
    const method = this.inferHttpMethod(input.description);

    // エンドポイントの生成
    const endpoint = this.generateEndpoint(input.description, input.category);

    const mockSpec: GeneratedApiSpec = {
      name: this.generateApiName(input.description),
      description: `Generated API for: ${input.description}`,
      endpoint,
      method,
      price:
        input.expectedPrice || priceMapping[input.complexityLevel] || "0.05",
      generatedCode: this.generateHonoCode(endpoint, method, input),
      documentation: this.generateDocumentation(endpoint, method, input),
    };

    // 実際の実装では非同期処理とエラーハンドリング
    await new Promise((resolve) => setTimeout(resolve, 100)); // APIコール模擬

    return mockSpec;
  }

  private generateApiName(description: string): string {
    // 簡単な名前生成ロジック
    if (description.includes("天気") || description.includes("weather")) {
      return "Weather Information API";
    }
    if (description.includes("翻訳") || description.includes("translate")) {
      return "Translation API";
    }
    if (description.includes("画像") || description.includes("image")) {
      return "Image Processing API";
    }
    return "Generated API";
  }

  private inferHttpMethod(
    description: string,
  ): "GET" | "POST" | "PUT" | "DELETE" | "PATCH" {
    const lowerDesc = description.toLowerCase();
    if (
      lowerDesc.includes("取得") ||
      lowerDesc.includes("get") ||
      lowerDesc.includes("fetch")
    ) {
      return "GET";
    }
    if (
      lowerDesc.includes("作成") ||
      lowerDesc.includes("create") ||
      lowerDesc.includes("post")
    ) {
      return "POST";
    }
    if (
      lowerDesc.includes("更新") ||
      lowerDesc.includes("update") ||
      lowerDesc.includes("put")
    ) {
      return "PUT";
    }
    if (lowerDesc.includes("削除") || lowerDesc.includes("delete")) {
      return "DELETE";
    }
    return "GET"; // デフォルト
  }

  private generateEndpoint(description: string, category: string): string {
    const lowerDesc = description.toLowerCase();

    if (lowerDesc.includes("天気") || lowerDesc.includes("weather")) {
      return "/api/weather";
    }
    if (lowerDesc.includes("翻訳") || lowerDesc.includes("translate")) {
      return "/api/translate";
    }
    if (lowerDesc.includes("画像") || lowerDesc.includes("image")) {
      return "/api/image";
    }

    // カテゴリベースのフォールバック
    return `/api/${category}`;
  }

  private generateHonoCode(
    endpoint: string,
    method: string,
    input: NaturalLanguageInput,
  ): string {
    const price = input.expectedPrice || "0.01";

    return `import { Hono } from 'hono'
import { x402 } from 'x402-hono'

const app = new Hono()

app.${method.toLowerCase()}('${endpoint}', 
  x402('0x1234567890123456789012345678901234567890', '$${price}'),
  async (c) => {
    try {
      // Generated API implementation
      const result = {
        success: true,
        data: {
          message: 'API response generated from: ${input.description}',
          timestamp: new Date().toISOString()
        }
      }
      
      return c.json(result)
    } catch (error) {
      return c.json({ error: 'Processing failed' }, 500)
    }
  }
)

export default app`;
  }

  private generateDocumentation(
    endpoint: string,
    method: string,
    input: NaturalLanguageInput,
  ): string {
    const price = input.expectedPrice || "0.01";

    return `# Generated API Documentation

## Overview
${input.description}

## Endpoint
- **${method}** \`${endpoint}\`

## Description
This API was automatically generated based on the user's natural language description.

## Pricing
- Cost: $${price} USDC per request
- Payment via x402 protocol on Base Sepolia

## Category
${input.category}

## Complexity Level
${input.complexityLevel}

${input.externalApis ? `## External APIs Used\n${input.externalApis.map((api) => `- ${api}`).join("\n")}` : ""}
`;
  }
}

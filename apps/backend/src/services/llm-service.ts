import type { NaturalLanguageInput } from "@repo/shared/api";
import { GeminiClient } from "../utils/gemini-client";

export interface GeneratedApiSpec {
  name: string;
  description: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  price: string;
  generatedCode: string;
  documentation: string;
}

export interface LLMResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SafetyValidationResult {
  isSafe: boolean;
  violations?: string[];
}

export class LLMService {
  private geminiClient: GeminiClient;

  constructor() {
    this.geminiClient = new GeminiClient();
  }

  async generateApiFromNaturalLanguage(
    input: NaturalLanguageInput,
  ): Promise<LLMResult<GeneratedApiSpec>> {
    try {
      // コンテンツポリシー違反チェック
      if (this.containsInappropriateContent(input.description)) {
        return {
          success: false,
          error: "Content policy violation detected",
        };
      }

      // 入力バリデーション
      if (input.description.length > 2000) {
        return {
          success: false,
          error: "Input validation failed",
        };
      }

      // Gemini APIでコード生成
      const geminiResponse = await this.geminiClient.generateCode(input);

      // レスポンス検証
      if (!this.isValidApiSpec(geminiResponse)) {
        return {
          success: false,
          error: "Invalid API specification generated",
        };
      }

      return {
        success: true,
        data: geminiResponse,
      };
    } catch (_error) {
      return {
        success: false,
        error: "LLM generation failed",
      };
    }
  }

  async validateApiSafety(
    code: string,
  ): Promise<LLMResult<SafetyValidationResult>> {
    try {
      // 危険なパターンをチェック
      const dangerousPatterns = [
        /import\s+fs\s+from/,
        /require\s*\(\s*['"]fs['"]\s*\)/,
        /exec\s*\(/,
        /spawn\s*\(/,
        /rm\s+-rf/,
        /eval\s*\(/,
        /Function\s*\(/,
        /process\.exit/,
        /process\.kill/,
      ];

      const violations: string[] = [];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          violations.push(`Dangerous pattern detected: ${pattern.source}`);
        }
      }

      if (violations.length > 0) {
        return {
          success: false,
          error: "Unsafe code detected",
        };
      }

      return {
        success: true,
        data: {
          isSafe: true,
          violations: [],
        },
      };
    } catch (_error) {
      return {
        success: false,
        error: "Safety validation failed",
      };
    }
  }

  private containsInappropriateContent(description: string): boolean {
    const inappropriateKeywords = [
      "マルウェア",
      "malware",
      "virus",
      "hack",
      "exploit",
      "illegal",
      "drug",
      "weapon",
      "violence",
    ];

    const lowerDescription = description.toLowerCase();
    return inappropriateKeywords.some((keyword) =>
      lowerDescription.includes(keyword.toLowerCase()),
    );
  }

  private isValidApiSpec(spec: unknown): spec is GeneratedApiSpec {
    return (
      typeof spec === "object" &&
      spec !== null &&
      typeof (spec as GeneratedApiSpec).name === "string" &&
      typeof (spec as GeneratedApiSpec).description === "string" &&
      typeof (spec as GeneratedApiSpec).endpoint === "string" &&
      typeof (spec as GeneratedApiSpec).method === "string" &&
      typeof (spec as GeneratedApiSpec).price === "string" &&
      typeof (spec as GeneratedApiSpec).generatedCode === "string" &&
      typeof (spec as GeneratedApiSpec).documentation === "string" &&
      ["GET", "POST", "PUT", "DELETE", "PATCH"].includes(
        (spec as GeneratedApiSpec).method,
      )
    );
  }
}

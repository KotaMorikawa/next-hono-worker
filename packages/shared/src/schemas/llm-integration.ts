import { z } from 'zod';

// LLMプロバイダー定義
export const LLMProvider = z.enum(['gemini-pro', 'gpt-4', 'gpt-3.5-turbo', 'claude-3'] as const);
export type LLMProvider = z.infer<typeof LLMProvider>;

// プログラミング言語定義
export const ProgrammingLanguage = z.enum([
  'typescript',
  'javascript', 
  'python',
  'rust',
  'go',
  'java',
  'other'
] as const);
export type ProgrammingLanguage = z.infer<typeof ProgrammingLanguage>;

// フレームワーク定義
export const Framework = z.enum([
  'hono',
  'express',
  'fastapi',
  'axum',
  'gin',
  'spring-boot',
  'other'
] as const);
export type Framework = z.infer<typeof Framework>;

// 生成ステータス定義
export const GenerationStatus = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'timeout'
] as const);
export type GenerationStatus = z.infer<typeof GenerationStatus>;

// 自然言語入力スキーマ
export const naturalLanguageInputSchema = z.object({
  userPrompt: z
    .string()
    .min(10, 'プロンプトは10文字以上で入力してください')
    .max(2000, 'プロンプトは2000文字以内で入力してください'),
  context: z
    .string()
    .max(5000, 'コンテキストは5000文字以内で入力してください')
    .optional(),
  constraints: z
    .array(z.string().max(200, '制約は200文字以内で入力してください'))
    .max(10, '制約は10個以下で設定してください')
    .default([]),
  preferredLanguage: ProgrammingLanguage.default('typescript'),
  preferredFramework: Framework.default('hono'),
  includeTests: z.boolean().default(false),
  includeDocumentation: z.boolean().default(true),
  complexity: z.enum(['simple', 'moderate', 'complex'] as const).default('moderate'),
});

// 生成されたコードスキーマ
export const generatedCodeSchema = z.object({
  id: z.string().min(1, 'コードIDが必要です'),
  sourcePrompt: z.string().min(1, '元のプロンプトが必要です'),
  code: z.string().min(1, '生成されたコードが必要です'),
  language: ProgrammingLanguage,
  framework: Framework,
  dependencies: z
    .array(z.object({
      name: z.string().min(1, '依存関係名が必要です'),
      version: z.string().min(1, 'バージョンが必要です'),
      description: z.string().optional(),
    }))
    .max(50, '依存関係は50個以下で設定してください')
    .default([]),
  executionTime: z
    .number()
    .min(0, '実行時間は0以上である必要があります')
    .max(300000, '実行時間は5分以下である必要があります'), // ミリ秒
  llmProvider: LLMProvider,
  modelVersion: z.string().optional(),
  status: GenerationStatus,
  errorMessage: z.string().optional(),
  qualityScore: z
    .number()
    .min(0, '品質スコアは0以上である必要があります')
    .max(100, '品質スコアは100以下である必要があります')
    .optional(),
  testCode: z.string().optional(),
  documentation: z.string().optional(),
  createdAt: z.date(),
  lastModifiedAt: z.date(),
});

// コード評価スキーマ
export const codeEvaluationSchema = z.object({
  codeId: z.string().min(1, 'コードIDが必要です'),
  userId: z.string().min(1, 'ユーザーIDが必要です'),
  rating: z
    .number()
    .int()
    .min(1, '評価は1以上である必要があります')
    .max(5, '評価は5以下である必要があります'),
  feedback: z
    .string()
    .max(1000, 'フィードバックは1000文字以内で入力してください')
    .optional(),
  isWorking: z.boolean(),
  improvementSuggestions: z
    .array(z.string().max(200))
    .max(5, '改善提案は5個以下で設定してください')
    .default([]),
  createdAt: z.date(),
});

// コード改善リクエストスキーマ
export const codeImprovementRequestSchema = z.object({
  originalCodeId: z.string().min(1, '元のコードIDが必要です'),
  improvementPrompt: z
    .string()
    .min(10, '改善プロンプトは10文字以上で入力してください')
    .max(1000, '改善プロンプトは1000文字以内で入力してください'),
  focusAreas: z
    .array(z.enum(['performance', 'security', 'readability', 'testing', 'documentation'] as const))
    .min(1, '少なくとも1つの改善領域を選択してください')
    .max(5, '改善領域は5個以下で設定してください'),
});

// コード検索スキーマ
export const codeSearchSchema = z.object({
  query: z.string().optional(),
  language: ProgrammingLanguage.optional(),
  framework: Framework.optional(),
  llmProvider: LLMProvider.optional(),
  minQualityScore: z.number().min(0).max(100).optional(),
  status: GenerationStatus.optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

// 型推論用のTypeScript型定義
export type NaturalLanguageInput = z.infer<typeof naturalLanguageInputSchema>;
export type GeneratedCode = z.infer<typeof generatedCodeSchema>;
export type CodeEvaluationInput = z.infer<typeof codeEvaluationSchema>;
export type CodeImprovementRequest = z.infer<typeof codeImprovementRequestSchema>;
export type CodeSearchInput = z.infer<typeof codeSearchSchema>;
export type CodeDependency = z.infer<typeof generatedCodeSchema>['dependencies'][0];
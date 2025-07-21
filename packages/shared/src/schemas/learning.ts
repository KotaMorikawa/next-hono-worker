import { z } from 'zod';

// 難易度レベル定義
export const DifficultyLevel = z.enum(['beginner', 'intermediate', 'advanced', 'expert'] as const);
export type DifficultyLevel = z.infer<typeof DifficultyLevel>;

// チュートリアルカテゴリ定義
export const TutorialCategory = z.enum([
  'x402-basics',
  'api-creation',
  'payment-integration',
  'advanced-features',
  'troubleshooting'
] as const);
export type TutorialCategory = z.infer<typeof TutorialCategory>;

// 完了状態定義
export const CompletionStatus = z.enum(['not_started', 'in_progress', 'completed', 'skipped'] as const);
export type CompletionStatus = z.infer<typeof CompletionStatus>;

// チュートリアルスキーマ
export const tutorialSchema = z.object({
  id: z.string().min(1, 'チュートリアルIDが必要です'),
  title: z
    .string()
    .min(1, 'タイトルを入力してください')
    .max(200, 'タイトルは200文字以内で入力してください'),
  content: z
    .string()
    .min(1, 'コンテンツを入力してください')
    .max(10000, 'コンテンツは10000文字以内で入力してください'),
  category: TutorialCategory,
  difficulty: DifficultyLevel,
  estimatedTime: z
    .number()
    .int()
    .min(1, '推定時間は1分以上で設定してください')
    .max(480, '推定時間は480分（8時間）以下で設定してください'), // 分単位
  prerequisites: z
    .array(z.string())
    .max(10, '前提条件は10個以下で設定してください')
    .default([]),
  tags: z
    .array(z.string().max(50, 'タグは50文字以内で入力してください'))
    .max(20, 'タグは20個以下で設定してください')
    .default([]),
  objectives: z
    .array(z.string().max(200, '学習目標は200文字以内で入力してください'))
    .min(1, '少なくとも1つの学習目標を設定してください')
    .max(10, '学習目標は10個以下で設定してください'),
  steps: z
    .array(z.object({
      id: z.string().min(1, 'ステップIDが必要です'),
      title: z.string().min(1, 'ステップタイトルが必要です').max(100),
      description: z.string().min(1, 'ステップ説明が必要です').max(1000),
      codeExample: z.string().optional(),
      expectedOutput: z.string().optional(),
    }))
    .min(1, '少なくとも1つのステップが必要です')
    .max(20, 'ステップは20個以下で設定してください'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// 学習進捗スキーマ
export const progressSchema = z.object({
  userId: z.string().min(1, 'ユーザーIDが必要です'),
  tutorialId: z.string().min(1, 'チュートリアルIDが必要です'),
  completedSteps: z
    .array(z.string())
    .default([]),
  totalSteps: z
    .number()
    .int()
    .min(1, '総ステップ数は1以上である必要があります'),
  status: CompletionStatus,
  startedAt: z.date(),
  completedAt: z.date().optional(),
  lastAccessedAt: z.date(),
  score: z
    .number()
    .min(0, 'スコアは0以上である必要があります')
    .max(100, 'スコアは100以下である必要があります')
    .optional(),
  timeSpent: z
    .number()
    .int()
    .min(0, '学習時間は0以上である必要があります'), // 分単位
  notes: z
    .string()
    .max(2000, 'メモは2000文字以内で入力してください')
    .optional(),
});

// 学習統計スキーマ
export const learningStatsSchema = z.object({
  userId: z.string().min(1, 'ユーザーIDが必要です'),
  totalTutorialsCompleted: z.number().int().min(0),
  totalTimeSpent: z.number().int().min(0), // 分単位
  averageScore: z.number().min(0).max(100).optional(),
  completionRate: z.number().min(0).max(1), // 0-1の範囲
  favoriteCategory: TutorialCategory.optional(),
  streak: z.object({
    current: z.number().int().min(0),
    longest: z.number().int().min(0),
    lastActivityDate: z.date().optional(),
  }),
  achievements: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    unlockedAt: z.date(),
  })).default([]),
});

// チュートリアル検索スキーマ
export const tutorialSearchSchema = z.object({
  query: z.string().optional(),
  category: TutorialCategory.optional(),
  difficulty: DifficultyLevel.optional(),
  tags: z.array(z.string()).optional(),
  maxDuration: z.number().int().min(1).optional(), // 分単位
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).default(0),
});

// 型推論用のTypeScript型定義
export type TutorialInput = z.infer<typeof tutorialSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
export type LearningStats = z.infer<typeof learningStatsSchema>;
export type TutorialSearchInput = z.infer<typeof tutorialSearchSchema>;
export type TutorialStep = z.infer<typeof tutorialSchema>['steps'][0];
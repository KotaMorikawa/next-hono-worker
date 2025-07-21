import { z } from 'zod';

// 支払い状態定義
export const PaymentStatus = z.enum([
  'pending',
  'processing', 
  'completed',
  'failed',
  'refunded'
] as const);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

// 課金期間定義
export const BillingPeriod = z.enum(['daily', 'weekly', 'monthly', 'yearly'] as const);
export type BillingPeriod = z.infer<typeof BillingPeriod>;

// API使用量統計スキーマ
export const usageStatsSchema = z.object({
  apiId: z.string().min(1, 'API IDが必要です'),
  userId: z.string().min(1, 'ユーザーIDが必要です'),
  timestamp: z.date(),
  requestCount: z
    .number()
    .int()
    .min(1, 'リクエスト数は1以上である必要があります'),
  responseTime: z
    .number()
    .min(0, 'レスポンス時間は0以上である必要があります')
    .max(60000, 'レスポンス時間は60秒以下である必要があります'), // ミリ秒
  errorCount: z
    .number()
    .int()
    .min(0, 'エラー数は0以上である必要があります'),
  bytesTransferred: z
    .number()
    .int()
    .min(0, '転送バイト数は0以上である必要があります'),
  costInUSDC: z
    .number()
    .min(0, 'コストは0以上である必要があります')
    .max(1000, 'コストは1000USDC以下である必要があります'),
});

// 課金内訳アイテム
export const billingBreakdownItemSchema = z.object({
  apiId: z.string().min(1, 'API IDが必要です'),
  apiName: z.string().min(1, 'API名が必要です'),
  requestCount: z.number().int().min(0),
  unitPrice: z.number().min(0),
  totalCost: z.number().min(0),
});

// 課金スキーマ
export const billingSchema = z.object({
  userId: z.string().min(1, 'ユーザーIDが必要です'),
  period: BillingPeriod,
  startDate: z.date(),
  endDate: z.date(),
  totalCost: z
    .number()
    .min(0, '総コストは0以上である必要があります')
    .max(10000, '総コストは10000USDC以下である必要があります'),
  breakdowns: z.array(billingBreakdownItemSchema),
  paymentStatus: PaymentStatus,
  transactionHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, '無効なトランザクションハッシュです')
    .optional(),
  createdAt: z.date(),
  paidAt: z.date().optional(),
});

// 使用量集計スキーマ
export const usageAggregationSchema = z.object({
  userId: z.string().min(1, 'ユーザーIDが必要です'),
  apiId: z.string().min(1, 'API IDが必要です').optional(),
  startDate: z.date(),
  endDate: z.date(),
  granularity: z.enum(['hour', 'day', 'week', 'month'] as const),
});

// 使用量レポートスキーマ
export const usageReportSchema = z.object({
  period: z.object({
    start: z.date(),
    end: z.date(),
  }),
  totalRequests: z.number().int().min(0),
  totalCost: z.number().min(0),
  averageResponseTime: z.number().min(0),
  errorRate: z.number().min(0).max(1), // 0-1の範囲でエラー率
  topApis: z.array(z.object({
    apiId: z.string(),
    apiName: z.string(),
    requestCount: z.number().int().min(0),
    cost: z.number().min(0),
  })).max(10),
});

// 型推論用のTypeScript型定義
export type UsageStatsInput = z.infer<typeof usageStatsSchema>;
export type BillingInput = z.infer<typeof billingSchema>;
export type BillingBreakdownItem = z.infer<typeof billingBreakdownItemSchema>;
export type UsageAggregationInput = z.infer<typeof usageAggregationSchema>;
export type UsageReport = z.infer<typeof usageReportSchema>;
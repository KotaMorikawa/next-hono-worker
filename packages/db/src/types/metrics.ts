// =============================================================================
// METRICS AND STATISTICS TYPE DEFINITIONS
// =============================================================================

/**
 * API使用量統計の型定義
 */
export interface ApiUsageStats {
  totalRequests: number;
  totalRevenue: string;
  averageResponseTime: number;
  totalErrors: number;
  errorRate: number;
}

/**
 * 人気API統計の型定義
 */
export interface TopApiStats {
  apiId: string;
  totalRequests: number;
  totalRevenue: string;
  averageResponseTime: number;
  errorRate: number;
}

/**
 * 日別使用量トレンドの型定義
 */
export interface DailyUsageTrend {
  date: Date;
  requests: number;
  revenue: string;
  errors: number;
  avgResponseTime: number;
}

/**
 * 期間別収益統計の型定義
 */
export interface RevenueByPeriod {
  period: string;
  totalRevenue: string;
  transactionCount: number;
}

/**
 * ユーザー学習統計の型定義
 */
export interface UserLearningStatistics {
  totalTutorials: number;
  completedTutorials: number;
  totalTimeSpent: number;
  averageProgress: number;
  lastActivity: Date;
}

/**
 * チュートリアル進捗統計の型定義
 */
export interface TutorialProgressStats {
  totalUsers: number;
  completedUsers: number;
  averageProgress: number;
  averageTimeSpent: number;
  completionRate: number;
}

/**
 * シミュレーション完了統計の型定義
 */
export interface SimulationCompletionStats {
  scenarioType: string;
  totalSimulations: number;
  completedSimulations: number;
  completionRate: number;
  averageSteps: number;
}

/**
 * 決済ステータス統計の型定義
 */
export interface PaymentStatusCount {
  status: string;
  count: number;
  totalAmount: string;
}

/**
 * API メトリクス統計の型定義（GeneratedApiOperations用）
 */
export interface ApiMetrics {
  totalRequests: number;
  totalRevenue: string;
  averageResponseTime: number;
  totalErrors: number;
  errorRate: number;
}
import { and, count, eq, lt, sql } from "drizzle-orm";
import {
  apiKeys,
  apiUsage,
  billingRecords,
  generatedApis,
  learningProgress,
  organizations,
  paymentRequests,
  simulationActions,
  simulations,
  tutorials,
  users,
} from "../schema";
import type { Database } from "../types";
import { logError } from "../utils/logger";

// =============================================================================
// TRANSACTION PROCESSOR - トランザクション処理と一括操作
// =============================================================================

export class TransactionProcessor {
  constructor(private db: Database) {}

  // x402決済完了処理 - PaymentRequest を BillingRecord に変換
  async processPaymentCompletion(data: {
    paymentRequestId: string;
    transactionHash: string;
    blockNumber: number;
    walletAddress: string;
  }) {
    try {
      return await this.db.transaction(async (tx) => {
        // PaymentRequest を取得して検証
        const paymentRequest = await tx
          .select()
          .from(paymentRequests)
          .where(eq(paymentRequests.id, data.paymentRequestId))
          .limit(1);

        if (paymentRequest.length === 0) {
          throw new Error(`PaymentRequest not found: ${data.paymentRequestId}`);
        }

        const request = paymentRequest[0];
        if (!request) {
          throw new Error(`PaymentRequest is null: ${data.paymentRequestId}`);
        }

        if (request.status !== "pending") {
          throw new Error(
            `PaymentRequest already processed: ${request.status}`,
          );
        }

        // PaymentRequest の状態を更新
        await tx
          .update(paymentRequests)
          .set({
            status: "completed",
            transactionHash: data.transactionHash,
            blockNumber: data.blockNumber,
            updatedAt: new Date(),
          })
          .where(eq(paymentRequests.id, data.paymentRequestId));

        // BillingRecord を作成
        const billingRecord = await tx
          .insert(billingRecords)
          .values({
            userId: request.userId,
            apiId: request.apiId,
            amount: request.amount,
            currency: request.currency,
            transactionHash: data.transactionHash,
            blockNumber: data.blockNumber,
            walletAddress: data.walletAddress,
          })
          .returning();

        // API使用量を更新 (その日の統計レコードを更新)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await tx
          .insert(apiUsage)
          .values({
            apiId: request.apiId,
            userId: request.userId,
            requestCount: 1,
            totalRevenue: request.amount,
            averageResponseTime: 0,
            errorCount: 0,
            date: today,
          })
          .onConflictDoUpdate({
            target: [apiUsage.apiId, apiUsage.date],
            set: {
              requestCount: sql`${apiUsage.requestCount} + 1`,
              totalRevenue: sql`${apiUsage.totalRevenue} + ${request.amount}`,
              updatedAt: new Date(),
            },
          });

        return {
          paymentRequest: request,
          billingRecord: billingRecord[0],
          success: true,
        };
      });
    } catch (error) {
      await logError(
        "processPaymentCompletion failed",
        error,
        "process_payment_completion",
      );
      throw error;
    }
  }

  // 一括API使用量更新処理
  async bulkUpdateApiUsage(
    usageData: Array<{
      apiId: string;
      userId: string;
      requestCount: number;
      errorCount: number;
      totalResponseTime: number;
      date: Date;
    }>,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        const results = [];

        for (const usage of usageData) {
          const averageResponseTime =
            usage.requestCount > 0
              ? Math.round(usage.totalResponseTime / usage.requestCount)
              : 0;

          const result = await tx
            .insert(apiUsage)
            .values({
              apiId: usage.apiId,
              userId: usage.userId,
              requestCount: usage.requestCount,
              totalRevenue: "0",
              averageResponseTime,
              errorCount: usage.errorCount,
              date: usage.date,
            })
            .onConflictDoUpdate({
              target: [apiUsage.apiId, apiUsage.date],
              set: {
                requestCount: sql`${apiUsage.requestCount} + ${usage.requestCount}`,
                errorCount: sql`${apiUsage.errorCount} + ${usage.errorCount}`,
                averageResponseTime: sql`
                  case when ${apiUsage.requestCount} + ${usage.requestCount} > 0 
                  then (
                    (${apiUsage.averageResponseTime} * ${apiUsage.requestCount} + ${averageResponseTime} * ${usage.requestCount}) 
                    / (${apiUsage.requestCount} + ${usage.requestCount})
                  )
                  else 0 end
                `,
                updatedAt: new Date(),
              },
            })
            .returning();

          results.push(result[0]);
        }

        return {
          processedCount: results.length,
          results,
          success: true,
        };
      });
    } catch (error) {
      await logError(
        "bulkUpdateApiUsage failed",
        error,
        "bulk_update_api_usage",
      );
      throw error;
    }
  }

  // 学習進捗の一括更新処理
  async bulkUpdateLearningProgress(
    progressData: Array<{
      userId: string;
      tutorialId: string;
      progress: number;
      timeSpent: number;
      completed?: boolean;
    }>,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        const results = [];

        for (const progress of progressData) {
          const isCompleted = progress.completed ?? progress.progress >= 100;

          const result = await tx
            .insert(learningProgress)
            .values({
              userId: progress.userId,
              tutorialId: progress.tutorialId,
              progress: Math.min(progress.progress, 100),
              completed: isCompleted,
              timeSpent: progress.timeSpent,
              lastAccessedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [learningProgress.userId, learningProgress.tutorialId],
              set: {
                progress: sql`greatest(${learningProgress.progress}, ${Math.min(progress.progress, 100)})`,
                completed: sql`${learningProgress.completed} or ${isCompleted}`,
                timeSpent: sql`${learningProgress.timeSpent} + ${progress.timeSpent}`,
                lastAccessedAt: new Date(),
                updatedAt: new Date(),
              },
            })
            .returning();

          results.push(result[0]);
        }

        return {
          processedCount: results.length,
          results,
          success: true,
        };
      });
    } catch (error) {
      await logError(
        "bulkUpdateLearningProgress failed",
        error,
        "bulk_update_learning_progress",
      );
      throw error;
    }
  }

  // 期限切れPaymentRequestの一括処理
  async processExpiredPaymentRequests() {
    try {
      return await this.db.transaction(async (tx) => {
        const now = new Date();

        // 期限切れのPendingリクエストを取得
        const expiredRequests = await tx
          .select()
          .from(paymentRequests)
          .where(
            and(
              eq(paymentRequests.status, "pending"),
              lt(paymentRequests.expiresAt, now),
            ),
          );

        if (expiredRequests.length === 0) {
          return { processedCount: 0, success: true };
        }

        // ステータスを expired に更新
        const expiredIds = expiredRequests.map((req) => req.id);

        await tx
          .update(paymentRequests)
          .set({
            status: "expired",
            updatedAt: now,
          })
          .where(
            and(
              eq(paymentRequests.status, "pending"),
              lt(paymentRequests.expiresAt, now),
            ),
          );

        return {
          processedCount: expiredRequests.length,
          expiredRequestIds: expiredIds,
          success: true,
        };
      });
    } catch (error) {
      await logError(
        "processExpiredPaymentRequests failed",
        error,
        "process_expired_payment_requests",
      );
      throw error;
    }
  }

  // データクリーンアップ処理 - 古いレコードの削除
  async cleanupOldRecords(retentionDays = 365) {
    try {
      return await this.db.transaction(async (tx) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // 古いAPI使用量レコードを削除
        const deletedUsage = await tx
          .delete(apiUsage)
          .where(lt(apiUsage.date, cutoffDate))
          .returning({ id: apiUsage.id });

        // 古い完了済みPaymentRequestを削除 (BillingRecordは保持)
        const deletedPayments = await tx
          .delete(paymentRequests)
          .where(
            and(
              eq(paymentRequests.status, "completed"),
              lt(paymentRequests.createdAt, cutoffDate),
            ),
          )
          .returning({ id: paymentRequests.id });

        // 古いシミュレーションアクションを削除
        const deletedActions = await tx
          .delete(simulationActions)
          .where(lt(simulationActions.timestamp, cutoffDate))
          .returning({ id: simulationActions.id });

        return {
          deletedUsageRecords: deletedUsage.length,
          deletedPaymentRequests: deletedPayments.length,
          deletedSimulationActions: deletedActions.length,
          cutoffDate,
          success: true,
        };
      });
    } catch (error) {
      await logError("cleanupOldRecords failed", error, "cleanup_old_records");
      throw error;
    }
  }

  // 全テーブル統計情報取得 (デバッグ・モニタリング用)
  async getTableStatistics() {
    try {
      return await this.db.transaction(async (tx) => {
        const stats = await Promise.all([
          tx.select({ count: count() }).from(users),
          tx.select({ count: count() }).from(organizations),
          tx.select({ count: count() }).from(apiKeys),
          tx.select({ count: count() }).from(generatedApis),
          tx.select({ count: count() }).from(apiUsage),
          tx.select({ count: count() }).from(billingRecords),
          tx.select({ count: count() }).from(tutorials),
          tx.select({ count: count() }).from(learningProgress),
          tx.select({ count: count() }).from(paymentRequests),
          tx.select({ count: count() }).from(simulations),
          tx.select({ count: count() }).from(simulationActions),
        ]);

        return {
          users: stats[0]?.[0]?.count || 0,
          organizations: stats[1]?.[0]?.count || 0,
          apiKeys: stats[2]?.[0]?.count || 0,
          generatedApis: stats[3]?.[0]?.count || 0,
          apiUsage: stats[4]?.[0]?.count || 0,
          billingRecords: stats[5]?.[0]?.count || 0,
          tutorials: stats[6]?.[0]?.count || 0,
          learningProgress: stats[7]?.[0]?.count || 0,
          paymentRequests: stats[8]?.[0]?.count || 0,
          simulations: stats[9]?.[0]?.count || 0,
          simulationActions: stats[10]?.[0]?.count || 0,
          timestamp: new Date(),
        };
      });
    } catch (error) {
      await logError(
        "getTableStatistics failed",
        error,
        "get_table_statistics",
      );
      throw error;
    }
  }
}

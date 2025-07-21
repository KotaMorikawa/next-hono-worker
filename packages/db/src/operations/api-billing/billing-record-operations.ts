import { desc, eq, sql } from "drizzle-orm";
import {
  type BillingRecordDB,
  type NewBillingRecordDB,
  billingRecords,
} from "../../schema";
import type { Database } from "../../types";
import type { RevenueByPeriod } from "../../types/metrics";
import {
  DatabaseError,
  DatabaseErrorType,
  getFirstOrNull,
  getFirstResult,
  type Result,
  tryAsync,
  validateRequired,
} from "../../utils/result";

// =============================================================================
// BILLING RECORD OPERATIONS - 課金記録管理
// =============================================================================

export class BillingRecordOperations {
  constructor(private db: Database) {}

  async create(data: NewBillingRecordDB): Promise<Result<BillingRecordDB>> {
    return tryAsync(async () => {
      const validationResult = validateRequired(data, ['userId', 'apiId', 'amount']);
      if (!validationResult.success) {
        throw new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          validationResult.error.message
        );
      }

      const result = await this.db
        .insert(billingRecords)
        .values(data)
        .returning();
      const firstResult = getFirstResult(result, "Failed to create billing record");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'create_billing_record', data });
  }

  async findById(id: string): Promise<Result<BillingRecordDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(billingRecords)
        .where(eq(billingRecords.id, id))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_billing_record_by_id', id });
  }

  async findByUser(userId: string, limit?: number): Promise<Result<BillingRecordDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(billingRecords)
        .where(eq(billingRecords.userId, userId))
        .orderBy(desc(billingRecords.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_billing_records_by_user', userId, limit });
  }

  async findByApi(apiId: string, limit?: number): Promise<Result<BillingRecordDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(billingRecords)
        .where(eq(billingRecords.apiId, apiId))
        .orderBy(desc(billingRecords.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_billing_records_by_api', apiId, limit });
  }

  async findByTransactionHash(
    transactionHash: string,
  ): Promise<Result<BillingRecordDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(billingRecords)
        .where(eq(billingRecords.transactionHash, transactionHash))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_billing_record_by_transaction_hash', transactionHash });
  }

  async getUserTotalRevenue(userId: string): Promise<Result<string>> {
    return tryAsync(async () => {
      const result = await this.db
        .select({
          totalRevenue:
            sql<string>`coalesce(sum(${billingRecords.amount}), 0)`.as(
              "total_revenue",
            ),
        })
        .from(billingRecords)
        .where(eq(billingRecords.userId, userId));

      return result[0]?.totalRevenue || "0";
    }, { operation: 'get_user_total_revenue', userId });
  }

  async getApiTotalRevenue(apiId: string): Promise<Result<string>> {
    return tryAsync(async () => {
      const result = await this.db
        .select({
          totalRevenue:
            sql<string>`coalesce(sum(${billingRecords.amount}), 0)`.as(
              "total_revenue",
            ),
        })
        .from(billingRecords)
        .where(eq(billingRecords.apiId, apiId));

      return result[0]?.totalRevenue || "0";
    }, { operation: 'get_api_total_revenue', apiId });
  }

  async getRevenueByPeriod(
    timeframe: "daily" | "weekly" | "monthly" = "daily",
    limit: number = 30,
  ): Promise<Result<RevenueByPeriod[]>> {
    return tryAsync(async () => {
      const truncateFunction =
        timeframe === "daily"
          ? "day"
          : timeframe === "weekly"
            ? "week"
            : "month";

      return await this.db
        .select({
          period: sql<string>`date_trunc('${sql.raw(truncateFunction)}', ${billingRecords.createdAt})`,
          totalRevenue:
            sql<string>`coalesce(sum(${billingRecords.amount}), 0)`.as(
              "total_revenue",
            ),
          transactionCount: sql<number>`count(*)`.as("transaction_count"),
        })
        .from(billingRecords)
        .groupBy(
          sql`date_trunc('${sql.raw(truncateFunction)}', ${billingRecords.createdAt})`,
        )
        .orderBy(
          sql`date_trunc('${sql.raw(truncateFunction)}', ${billingRecords.createdAt}) desc`,
        )
        .limit(limit);
    }, { operation: 'get_revenue_by_period', timeframe, limit });
  }
}
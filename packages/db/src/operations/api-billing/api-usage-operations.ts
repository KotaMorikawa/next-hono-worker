import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  type ApiUsageDB,
  type NewApiUsageDB,
  apiUsage,
} from "../../schema";
import type { Database } from "../../types";
import type {
  ApiUsageStats,
  DailyUsageTrend,
  TopApiStats,
} from "../../types/metrics";
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
// API USAGE OPERATIONS - API使用量管理
// =============================================================================

export class ApiUsageOperations {
  constructor(private db: Database) {}

  async create(data: NewApiUsageDB): Promise<Result<ApiUsageDB>> {
    return tryAsync(async () => {
      const validationResult = validateRequired(data, ['apiId', 'userId', 'date']);
      if (!validationResult.success) {
        throw new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          validationResult.error.message
        );
      }

      const result = await this.db.insert(apiUsage).values(data).returning();
      const firstResult = getFirstResult(result, "Failed to create API usage record");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'create_api_usage', data });
  }

  async findByApiAndDate(
    apiId: string,
    date: Date,
  ): Promise<Result<ApiUsageDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(apiUsage)
        .where(and(eq(apiUsage.apiId, apiId), eq(apiUsage.date, date)))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_api_usage_by_api_and_date', apiId, date });
  }

  async updateUsage(
    apiId: string,
    userId: string,
    requestCount: number,
    errorCount: number,
    responseTime: number,
    date: Date,
  ): Promise<Result<ApiUsageDB>> {
    return tryAsync(async () => {
      const result = await this.db
        .insert(apiUsage)
        .values({
          apiId,
          userId,
          requestCount,
          totalRevenue: "0",
          averageResponseTime: responseTime,
          errorCount,
          date,
        })
        .onConflictDoUpdate({
          target: [apiUsage.apiId, apiUsage.date],
          set: {
            requestCount: sql`${apiUsage.requestCount} + ${requestCount}`,
            errorCount: sql`${apiUsage.errorCount} + ${errorCount}`,
            averageResponseTime: sql`
              case when ${apiUsage.requestCount} + ${requestCount} > 0 
              then (
                (${apiUsage.averageResponseTime} * ${apiUsage.requestCount} + ${responseTime} * ${requestCount}) 
                / (${apiUsage.requestCount} + ${requestCount})
              )
              else 0 end
            `,
            updatedAt: new Date(),
          },
        })
        .returning();

      const firstResult = getFirstResult(result, "Failed to update API usage");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'update_api_usage', apiId, userId, date });
  }

  async getApiUsageStats(apiId: string, days: number = 30): Promise<Result<ApiUsageStats[]>> {
    return tryAsync(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await this.db
        .select({
          totalRequests:
            sql<number>`coalesce(sum(${apiUsage.requestCount}), 0)`.as(
              "total_requests",
            ),
          totalRevenue:
            sql<string>`coalesce(sum(${apiUsage.totalRevenue}), 0)`.as(
              "total_revenue",
            ),
          averageResponseTime:
            sql<number>`coalesce(avg(${apiUsage.averageResponseTime}), 0)`.as(
              "avg_response_time",
            ),
          totalErrors: sql<number>`coalesce(sum(${apiUsage.errorCount}), 0)`.as(
            "total_errors",
          ),
          errorRate:
            sql<number>`case when sum(${apiUsage.requestCount}) > 0 then (sum(${apiUsage.errorCount})::float / sum(${apiUsage.requestCount}) * 100) else 0 end`.as(
              "error_rate",
            ),
        })
        .from(apiUsage)
        .where(and(eq(apiUsage.apiId, apiId), gte(apiUsage.date, startDate)));
    }, { operation: 'get_api_usage_stats', apiId, days });
  }

  async getTopApisByRequests(limit: number = 10): Promise<Result<TopApiStats[]>> {
    return tryAsync(async () => {
      return await this.db
        .select({
          apiId: apiUsage.apiId,
          totalRequests: sql<number>`sum(${apiUsage.requestCount})`.as(
            "total_requests",
          ),
          totalRevenue: sql<string>`sum(${apiUsage.totalRevenue})`.as(
            "total_revenue",
          ),
          averageResponseTime:
            sql<number>`avg(${apiUsage.averageResponseTime})`.as(
              "avg_response_time",
            ),
          errorRate:
            sql<number>`case when sum(${apiUsage.requestCount}) > 0 then (sum(${apiUsage.errorCount})::float / sum(${apiUsage.requestCount}) * 100) else 0 end`.as(
              "error_rate",
            ),
        })
        .from(apiUsage)
        .groupBy(apiUsage.apiId)
        .orderBy(desc(sql`sum(${apiUsage.requestCount})`))
        .limit(limit);
    }, { operation: 'get_top_apis_by_requests', limit });
  }

  async getDailyUsageTrend(apiId: string, days: number = 30): Promise<Result<DailyUsageTrend[]>> {
    return tryAsync(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await this.db
        .select({
          date: apiUsage.date,
          requests: apiUsage.requestCount,
          revenue: apiUsage.totalRevenue,
          errors: apiUsage.errorCount,
          avgResponseTime: apiUsage.averageResponseTime,
        })
        .from(apiUsage)
        .where(and(eq(apiUsage.apiId, apiId), gte(apiUsage.date, startDate)))
        .orderBy(desc(apiUsage.date));
    }, { operation: 'get_daily_usage_trend', apiId, days });
  }
}
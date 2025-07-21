import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  type GeneratedApiDB,
  type NewGeneratedApiDB,
  apiUsage,
  generatedApis,
} from "../../schema";
import type { Database } from "../../types";
import type { ApiMetrics } from "../../types/metrics";
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
// GENERATED API OPERATIONS - 生成API管理
// =============================================================================

export class GeneratedApiOperations {
  constructor(private db: Database) {}

  async create(data: NewGeneratedApiDB): Promise<Result<GeneratedApiDB>> {
    return tryAsync(async () => {
      const validationResult = validateRequired(data, ['name', 'endpoint', 'userId']);
      if (!validationResult.success) {
        throw new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          validationResult.error.message
        );
      }

      const result = await this.db.insert(generatedApis).values(data).returning();
      const firstResult = getFirstResult(result, "Failed to create generated API");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'create_generated_api', data });
  }

  async findById(id: string): Promise<Result<GeneratedApiDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(generatedApis)
        .where(eq(generatedApis.id, id))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_generated_api_by_id', id });
  }

  async findByEndpoint(endpoint: string): Promise<Result<GeneratedApiDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(generatedApis)
        .where(eq(generatedApis.endpoint, endpoint))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_generated_api_by_endpoint', endpoint });
  }

  async findByUser(userId: string, limit?: number): Promise<Result<GeneratedApiDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(generatedApis)
        .where(eq(generatedApis.userId, userId))
        .orderBy(desc(generatedApis.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_generated_apis_by_user', userId, limit });
  }

  async findByStatus(
    status: string,
    limit?: number,
  ): Promise<Result<GeneratedApiDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(generatedApis)
        .where(eq(generatedApis.status, status))
        .orderBy(desc(generatedApis.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_generated_apis_by_status', status, limit });
  }

  async update(
    id: string,
    data: Partial<NewGeneratedApiDB>,
  ): Promise<Result<GeneratedApiDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .update(generatedApis)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(generatedApis.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'update_generated_api', id, data });
  }

  async updateStatus(
    id: string,
    status: string,
  ): Promise<Result<GeneratedApiDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .update(generatedApis)
        .set({ status, updatedAt: new Date() })
        .where(eq(generatedApis.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'update_generated_api_status', id, status });
  }

  async delete(id: string): Promise<Result<boolean>> {
    return tryAsync(async () => {
      const result = await this.db
        .delete(generatedApis)
        .where(eq(generatedApis.id, id))
        .returning();
      return result.length > 0;
    }, { operation: 'delete_generated_api', id });
  }

  async search(query: string, limit?: number): Promise<Result<GeneratedApiDB[]>> {
    return tryAsync(async () => {
      const searchQuery = `%${query}%`;
      const searchDbQuery = this.db
        .select()
        .from(generatedApis)
        .where(
          sql`(${generatedApis.name} ilike ${searchQuery} or ${generatedApis.description} ilike ${searchQuery})`,
        )
        .orderBy(desc(generatedApis.createdAt));

      return limit ? await searchDbQuery.limit(limit) : await searchDbQuery;
    }, { operation: 'search_generated_apis', query, limit });
  }

  async getApiMetrics(apiId: string, days: number = 30): Promise<Result<ApiMetrics[]>> {
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
    }, { operation: 'get_api_metrics', apiId, days });
  }
}
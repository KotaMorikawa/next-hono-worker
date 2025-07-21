import { and, avg, count, desc, eq, gte, max, sql, sum } from "drizzle-orm";
import {
  apiUsage,
  billingRecords,
  generatedApis,
  learningProgress,
  organizations,
  tutorials,
  users,
} from "../schema";
import type { Database } from "../types";
import { logError } from "../utils/logger";

// =============================================================================
// ANALYTICS AND STATISTICS
// =============================================================================

// Database Analytics - 横断的分析機能
export class DatabaseAnalytics {
  constructor(private db: Database) {}

  // 収益分析
  async getRevenueAnalytics(
    timeframe: "daily" | "weekly" | "monthly" = "daily",
    limit: number = 30,
  ) {
    try {
      const truncateFunction =
        timeframe === "daily"
          ? "day"
          : timeframe === "weekly"
            ? "week"
            : "month";

      return await this.db
        .select({
          period: sql<string>`date_trunc('${sql.raw(truncateFunction)}', ${billingRecords.createdAt})`,
          totalRevenue: sum(billingRecords.amount).as("total_revenue"),
          transactionCount: count(billingRecords.id).as("transaction_count"),
          uniqueUsers: sql<number>`count(distinct ${billingRecords.userId})`.as(
            "unique_users",
          ),
          uniqueApis: sql<number>`count(distinct ${billingRecords.apiId})`.as(
            "unique_apis",
          ),
        })
        .from(billingRecords)
        .groupBy(
          sql`date_trunc('${sql.raw(truncateFunction)}', ${billingRecords.createdAt})`,
        )
        .orderBy(
          sql`date_trunc('${sql.raw(truncateFunction)}', ${billingRecords.createdAt}) desc`,
        )
        .limit(limit);
    } catch (error) {
      await logError(
        "getRevenueAnalytics failed",
        error,
        "get_revenue_analytics",
      );
      return [];
    }
  }

  // API別収益ランキング
  async getTopApisByRevenue(limit: number = 10) {
    try {
      return await this.db
        .select({
          apiId: billingRecords.apiId,
          apiName: generatedApis.name,
          apiEndpoint: generatedApis.endpoint,
          totalRevenue: sum(billingRecords.amount).as("total_revenue"),
          transactionCount: count(billingRecords.id).as("transaction_count"),
          avgTransactionValue: avg(billingRecords.amount).as(
            "avg_transaction_value",
          ),
          lastTransaction: max(billingRecords.createdAt).as("last_transaction"),
        })
        .from(billingRecords)
        .innerJoin(generatedApis, eq(billingRecords.apiId, generatedApis.id))
        .groupBy(
          billingRecords.apiId,
          generatedApis.name,
          generatedApis.endpoint,
        )
        .orderBy(desc(sum(billingRecords.amount)))
        .limit(limit);
    } catch (error) {
      await logError(
        "getTopApisByRevenue failed",
        error,
        "get_top_apis_by_revenue",
      );
      return [];
    }
  }

  // ユーザー活動分析
  async getUserActivityAnalytics(userId?: string) {
    try {
      const baseQuery = this.db
        .select({
          userId: users.id,
          userName: users.name,
          userEmail: users.email,
          totalApisCreated: sql<number>`count(distinct ${generatedApis.id})`.as(
            "total_apis_created",
          ),
          totalRevenue:
            sql<string>`coalesce(sum(${billingRecords.amount}), 0)`.as(
              "total_revenue",
            ),
          totalTransactions:
            sql<number>`count(distinct ${billingRecords.id})`.as(
              "total_transactions",
            ),
          completedTutorials:
            sql<number>`count(distinct case when ${learningProgress.completed} = true then ${learningProgress.tutorialId} end)`.as(
              "completed_tutorials",
            ),
          totalLearningTime:
            sql<number>`coalesce(sum(${learningProgress.timeSpent}), 0)`.as(
              "total_learning_time",
            ),
          lastActivity: sql<Date>`greatest(
            max(${generatedApis.updatedAt}),
            max(${billingRecords.createdAt}),
            max(${learningProgress.lastAccessedAt})
          )`.as("last_activity"),
        })
        .from(users)
        .leftJoin(generatedApis, eq(users.id, generatedApis.userId))
        .leftJoin(billingRecords, eq(users.id, billingRecords.userId))
        .leftJoin(learningProgress, eq(users.id, learningProgress.userId))
        .groupBy(users.id, users.name, users.email);

      if (userId) {
        return await baseQuery.where(eq(users.id, userId));
      }

      return await baseQuery.orderBy(
        desc(sql`greatest(
        max(${generatedApis.updatedAt}),
        max(${billingRecords.createdAt}),
        max(${learningProgress.lastAccessedAt})
      )`),
      );
    } catch (error) {
      await logError(
        "getUserActivityAnalytics failed",
        error,
        "get_user_activity_analytics",
      );
      return [];
    }
  }

  // API パフォーマンス統計
  async getApiPerformanceStats(apiId?: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const whereConditions = apiId
        ? and(gte(apiUsage.date, startDate), eq(apiUsage.apiId, apiId))
        : gte(apiUsage.date, startDate);

      return await this.db
        .select({
          apiId: apiUsage.apiId,
          apiName: generatedApis.name,
          apiEndpoint: generatedApis.endpoint,
          totalRequests: sum(apiUsage.requestCount).as("total_requests"),
          totalRevenue: sum(apiUsage.totalRevenue).as("total_revenue"),
          averageResponseTime: avg(apiUsage.averageResponseTime).as(
            "avg_response_time",
          ),
          totalErrors: sum(apiUsage.errorCount).as("total_errors"),
          errorRate:
            sql<number>`case when sum(${apiUsage.requestCount}) > 0 then (sum(${apiUsage.errorCount})::float / sum(${apiUsage.requestCount}) * 100) else 0 end`.as(
              "error_rate",
            ),
          revenuePerRequest:
            sql<number>`case when sum(${apiUsage.requestCount}) > 0 then (sum(${apiUsage.totalRevenue})::float / sum(${apiUsage.requestCount})) else 0 end`.as(
              "revenue_per_request",
            ),
        })
        .from(apiUsage)
        .innerJoin(generatedApis, eq(apiUsage.apiId, generatedApis.id))
        .where(whereConditions)
        .groupBy(apiUsage.apiId, generatedApis.name, generatedApis.endpoint)
        .orderBy(desc(sum(apiUsage.totalRevenue)));
    } catch (error) {
      await logError(
        "getApiPerformanceStats failed",
        error,
        "get_api_performance_stats",
      );
      return [];
    }
  }

  // 組織レベル分析
  async getOrganizationAnalytics(organizationId?: string) {
    try {
      const baseQuery = this.db
        .select({
          organizationId: organizations.id,
          organizationName: organizations.name,
          organizationDomain: organizations.domain,
          memberCount: sql<number>`count(distinct ${users.id})`.as(
            "member_count",
          ),
          totalApisCreated: sql<number>`count(distinct ${generatedApis.id})`.as(
            "total_apis_created",
          ),
          totalRevenue:
            sql<string>`coalesce(sum(${billingRecords.amount}), 0)`.as(
              "total_revenue",
            ),
          activeMembers:
            sql<number>`count(distinct case when ${generatedApis.updatedAt} > current_date - interval '30 days' then ${users.id} end)`.as(
              "active_members",
            ),
          avgRevenuePerMember:
            sql<number>`case when count(distinct ${users.id}) > 0 then (coalesce(sum(${billingRecords.amount}), 0)::float / count(distinct ${users.id})) else 0 end`.as(
              "avg_revenue_per_member",
            ),
        })
        .from(organizations)
        .leftJoin(users, eq(organizations.id, users.organizationId))
        .leftJoin(generatedApis, eq(users.id, generatedApis.userId))
        .leftJoin(billingRecords, eq(users.id, billingRecords.userId))
        .groupBy(organizations.id, organizations.name, organizations.domain);

      if (organizationId) {
        return await baseQuery.where(eq(organizations.id, organizationId));
      }

      return await baseQuery.orderBy(
        desc(sql`coalesce(sum(${billingRecords.amount}), 0)`),
      );
    } catch (error) {
      await logError(
        "getOrganizationAnalytics failed",
        error,
        "get_organization_analytics",
      );
      return [];
    }
  }

  // 学習効果分析
  async getLearningEffectivenessAnalytics() {
    try {
      return await this.db
        .select({
          tutorialId: tutorials.id,
          tutorialTitle: tutorials.title,
          tutorialCategory: tutorials.category,
          tutorialDifficulty: tutorials.difficulty,
          enrollmentCount:
            sql<number>`count(distinct ${learningProgress.userId})`.as(
              "enrollment_count",
            ),
          completionCount:
            sql<number>`count(distinct case when ${learningProgress.completed} = true then ${learningProgress.userId} end)`.as(
              "completion_count",
            ),
          completionRate:
            sql<number>`case when count(distinct ${learningProgress.userId}) > 0 then (count(distinct case when ${learningProgress.completed} = true then ${learningProgress.userId} end)::float / count(distinct ${learningProgress.userId}) * 100) else 0 end`.as(
              "completion_rate",
            ),
          avgTimeToComplete:
            sql<number>`avg(case when ${learningProgress.completed} = true then ${learningProgress.timeSpent} end)`.as(
              "avg_time_to_complete",
            ),
          avgProgress: avg(learningProgress.progress).as("avg_progress"),
          successfulApiCreations:
            sql<number>`count(distinct case when ${learningProgress.completed} = true and ${generatedApis.status} = 'published' then ${generatedApis.id} end)`.as(
              "successful_api_creations",
            ),
        })
        .from(tutorials)
        .leftJoin(
          learningProgress,
          eq(tutorials.id, learningProgress.tutorialId),
        )
        .leftJoin(
          generatedApis,
          and(
            eq(learningProgress.userId, generatedApis.userId),
            gte(generatedApis.createdAt, learningProgress.lastAccessedAt),
          ),
        )
        .groupBy(
          tutorials.id,
          tutorials.title,
          tutorials.category,
          tutorials.difficulty,
        )
        .orderBy(
          desc(
            sql`case when count(distinct ${learningProgress.userId}) > 0 then (count(distinct case when ${learningProgress.completed} = true then ${learningProgress.userId} end)::float / count(distinct ${learningProgress.userId}) * 100) else 0 end`,
          ),
        );
    } catch (error) {
      await logError(
        "getLearningEffectivenessAnalytics failed",
        error,
        "get_learning_effectiveness_analytics",
      );
      return [];
    }
  }
}

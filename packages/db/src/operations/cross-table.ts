import { and, desc, eq, sql } from "drizzle-orm";
import {
  apiUsage,
  billingRecords,
  generatedApis,
  learningProgress,
  organizations,
  paymentRequests,
  tutorials,
  users,
} from "../schema";
import type { Database } from "../types";
import { logError } from "../utils/logger";

// =============================================================================
// CROSS TABLE QUERIES - 複雑なJOINクエリと統合ビュー
// =============================================================================

export class CrossTableQueries {
  constructor(private db: Database) {}

  // ユーザー統合ビュー - 進捗、使用量、課金を統合
  async getUserIntegratedView(userId?: string) {
    try {
      const baseQuery = this.db
        .select({
          // User Info
          userId: users.id,
          userName: users.name,
          userEmail: users.email,
          organizationName: organizations.name,

          // Learning Stats
          totalTutorials:
            sql<number>`count(distinct ${learningProgress.tutorialId})`.as(
              "total_tutorials",
            ),
          completedTutorials:
            sql<number>`count(distinct case when ${learningProgress.completed} = true then ${learningProgress.tutorialId} end)`.as(
              "completed_tutorials",
            ),
          totalLearningTime:
            sql<number>`coalesce(sum(${learningProgress.timeSpent}), 0)`.as(
              "total_learning_time",
            ),
          avgProgress:
            sql<number>`coalesce(avg(${learningProgress.progress}), 0)`.as(
              "avg_progress",
            ),

          // API Creation Stats
          totalApisCreated: sql<number>`count(distinct ${generatedApis.id})`.as(
            "total_apis_created",
          ),
          publishedApis:
            sql<number>`count(distinct case when ${generatedApis.status} = 'published' then ${generatedApis.id} end)`.as(
              "published_apis",
            ),
          draftApis:
            sql<number>`count(distinct case when ${generatedApis.status} = 'draft' then ${generatedApis.id} end)`.as(
              "draft_apis",
            ),

          // Usage & Revenue Stats
          totalApiRequests:
            sql<number>`coalesce(sum(${apiUsage.requestCount}), 0)`.as(
              "total_api_requests",
            ),
          totalRevenue:
            sql<string>`coalesce(sum(${billingRecords.amount}), 0)`.as(
              "total_revenue",
            ),
          totalTransactions:
            sql<number>`count(distinct ${billingRecords.id})`.as(
              "total_transactions",
            ),
          avgRevenuePerApi:
            sql<number>`case when count(distinct ${generatedApis.id}) > 0 then (coalesce(sum(${billingRecords.amount}), 0)::float / count(distinct ${generatedApis.id})) else 0 end`.as(
              "avg_revenue_per_api",
            ),

          // Activity Timeline
          firstActivity: sql<Date>`least(
            min(${learningProgress.createdAt}),
            min(${generatedApis.createdAt})
          )`.as("first_activity"),
          lastActivity: sql<Date>`greatest(
            max(${learningProgress.lastAccessedAt}),
            max(${generatedApis.updatedAt}),
            max(${billingRecords.createdAt})
          )`.as("last_activity"),

          // Performance Metrics
          avgErrorRate:
            sql<number>`case when sum(${apiUsage.requestCount}) > 0 then (sum(${apiUsage.errorCount})::float / sum(${apiUsage.requestCount}) * 100) else 0 end`.as(
              "avg_error_rate",
            ),
          avgResponseTime:
            sql<number>`coalesce(avg(${apiUsage.averageResponseTime}), 0)`.as(
              "avg_response_time",
            ),
        })
        .from(users)
        .leftJoin(organizations, eq(users.organizationId, organizations.id))
        .leftJoin(learningProgress, eq(users.id, learningProgress.userId))
        .leftJoin(generatedApis, eq(users.id, generatedApis.userId))
        .leftJoin(apiUsage, eq(generatedApis.id, apiUsage.apiId))
        .leftJoin(billingRecords, eq(users.id, billingRecords.userId))
        .groupBy(users.id, users.name, users.email, organizations.name);

      if (userId) {
        return await baseQuery.where(eq(users.id, userId));
      }

      return await baseQuery.orderBy(
        desc(sql`greatest(
        max(${learningProgress.lastAccessedAt}),
        max(${generatedApis.updatedAt}),
        max(${billingRecords.createdAt})
      )`),
      );
    } catch (error) {
      await logError(
        "getUserIntegratedView failed",
        error,
        "get_user_integrated_view",
      );
      return [];
    }
  }

  // API エコシステム分析 - 生成から収益までの全体フロー
  async getApiEcosystemAnalysis(apiId?: string) {
    try {
      const baseQuery = this.db
        .select({
          // API Basic Info
          apiId: generatedApis.id,
          apiName: generatedApis.name,
          apiEndpoint: generatedApis.endpoint,
          apiMethod: generatedApis.method,
          apiPrice: generatedApis.price,
          apiStatus: generatedApis.status,

          // Creator Info
          creatorName: users.name,
          creatorEmail: users.email,
          organizationName: organizations.name,

          // Lifecycle Metrics
          daysSinceCreation:
            sql<number>`extract(day from current_timestamp - ${generatedApis.createdAt})`.as(
              "days_since_creation",
            ),
          daysSinceLastUpdate:
            sql<number>`extract(day from current_timestamp - ${generatedApis.updatedAt})`.as(
              "days_since_last_update",
            ),

          // Usage Statistics
          totalRequests:
            sql<number>`coalesce(sum(${apiUsage.requestCount}), 0)`.as(
              "total_requests",
            ),
          totalErrors: sql<number>`coalesce(sum(${apiUsage.errorCount}), 0)`.as(
            "total_errors",
          ),
          avgResponseTime:
            sql<number>`coalesce(avg(${apiUsage.averageResponseTime}), 0)`.as(
              "avg_response_time",
            ),
          successRate:
            sql<number>`case when sum(${apiUsage.requestCount}) > 0 then ((sum(${apiUsage.requestCount}) - sum(${apiUsage.errorCount}))::float / sum(${apiUsage.requestCount}) * 100) else 0 end`.as(
              "success_rate",
            ),

          // Revenue Performance
          totalRevenue:
            sql<string>`coalesce(sum(${billingRecords.amount}), 0)`.as(
              "total_revenue",
            ),
          totalTransactions:
            sql<number>`count(distinct ${billingRecords.id})`.as(
              "total_transactions",
            ),
          avgTransactionValue:
            sql<number>`case when count(distinct ${billingRecords.id}) > 0 then (sum(${billingRecords.amount})::float / count(distinct ${billingRecords.id})) else 0 end`.as(
              "avg_transaction_value",
            ),
          revenuePerRequest:
            sql<number>`case when sum(${apiUsage.requestCount}) > 0 then (sum(${billingRecords.amount})::float / sum(${apiUsage.requestCount})) else 0 end`.as(
              "revenue_per_request",
            ),

          // Growth Trends
          last7DaysRequests:
            sql<number>`coalesce(sum(case when ${apiUsage.date} > current_date - interval '7 days' then ${apiUsage.requestCount} else 0 end), 0)`.as(
              "last_7_days_requests",
            ),
          last30DaysRevenue:
            sql<string>`coalesce(sum(case when ${billingRecords.createdAt} > current_date - interval '30 days' then ${billingRecords.amount} else 0 end), 0)`.as(
              "last_30_days_revenue",
            ),

          // Payment Metrics
          pendingPayments:
            sql<number>`count(distinct case when ${paymentRequests.status} = 'pending' then ${paymentRequests.id} end)`.as(
              "pending_payments",
            ),
          failedPayments:
            sql<number>`count(distinct case when ${paymentRequests.status} = 'failed' then ${paymentRequests.id} end)`.as(
              "failed_payments",
            ),
          completedPayments:
            sql<number>`count(distinct case when ${paymentRequests.status} = 'completed' then ${paymentRequests.id} end)`.as(
              "completed_payments",
            ),
        })
        .from(generatedApis)
        .innerJoin(users, eq(generatedApis.userId, users.id))
        .leftJoin(organizations, eq(users.organizationId, organizations.id))
        .leftJoin(apiUsage, eq(generatedApis.id, apiUsage.apiId))
        .leftJoin(billingRecords, eq(generatedApis.id, billingRecords.apiId))
        .leftJoin(paymentRequests, eq(generatedApis.id, paymentRequests.apiId))
        .groupBy(
          generatedApis.id,
          generatedApis.name,
          generatedApis.endpoint,
          generatedApis.method,
          generatedApis.price,
          generatedApis.status,
          generatedApis.createdAt,
          generatedApis.updatedAt,
          users.name,
          users.email,
          organizations.name,
        );

      if (apiId) {
        return await baseQuery.where(eq(generatedApis.id, apiId));
      }

      return await baseQuery.orderBy(
        desc(sql`coalesce(sum(${billingRecords.amount}), 0)`),
      );
    } catch (error) {
      await logError(
        "getApiEcosystemAnalysis failed",
        error,
        "get_api_ecosystem_analysis",
      );
      return [];
    }
  }

  // 学習効果とAPI成功相関分析
  async getLearningToApiSuccessCorrelation() {
    try {
      return await this.db
        .select({
          userId: users.id,
          userName: users.name,

          // Learning Metrics
          totalTutorialsCompleted:
            sql<number>`count(distinct case when ${learningProgress.completed} = true then ${learningProgress.tutorialId} end)`.as(
              "total_tutorials_completed",
            ),
          totalLearningTime:
            sql<number>`coalesce(sum(${learningProgress.timeSpent}), 0)`.as(
              "total_learning_time",
            ),
          avgLearningProgress:
            sql<number>`coalesce(avg(${learningProgress.progress}), 0)`.as(
              "avg_learning_progress",
            ),

          // API Success Metrics
          totalApisCreated: sql<number>`count(distinct ${generatedApis.id})`.as(
            "total_apis_created",
          ),
          successfulApis:
            sql<number>`count(distinct case when ${generatedApis.status} = 'published' and ${billingRecords.amount} > 0 then ${generatedApis.id} end)`.as(
              "successful_apis",
            ),
          apiSuccessRate:
            sql<number>`case when count(distinct ${generatedApis.id}) > 0 then (count(distinct case when ${generatedApis.status} = 'published' and ${billingRecords.amount} > 0 then ${generatedApis.id} end)::float / count(distinct ${generatedApis.id}) * 100) else 0 end`.as(
              "api_success_rate",
            ),

          // Performance Correlation
          avgApiRevenue:
            sql<number>`case when count(distinct ${generatedApis.id}) > 0 then (coalesce(sum(${billingRecords.amount}), 0)::float / count(distinct ${generatedApis.id})) else 0 end`.as(
              "avg_api_revenue",
            ),
          timeToFirstApi:
            sql<number>`extract(day from min(${generatedApis.createdAt}) - min(${learningProgress.createdAt}))`.as(
              "time_to_first_api",
            ),

          // Quality Indicators
          avgErrorRate:
            sql<number>`case when sum(${apiUsage.requestCount}) > 0 then (sum(${apiUsage.errorCount})::float / sum(${apiUsage.requestCount}) * 100) else 0 end`.as(
              "avg_error_rate",
            ),
          avgResponseTime:
            sql<number>`coalesce(avg(${apiUsage.averageResponseTime}), 0)`.as(
              "avg_response_time",
            ),

          // Learning Path Analysis
          preferredCategory:
            sql<string>`mode() within group (order by ${tutorials.category})`.as(
              "preferred_category",
            ),
          avgDifficulty: sql<number>`case 
            when count(distinct ${tutorials.id}) > 0 then
              avg(case 
                when ${tutorials.difficulty} = 'beginner' then 1
                when ${tutorials.difficulty} = 'intermediate' then 2
                when ${tutorials.difficulty} = 'advanced' then 3
                else 0
              end)
            else 0
          end`.as("avg_difficulty"),
        })
        .from(users)
        .innerJoin(learningProgress, eq(users.id, learningProgress.userId))
        .innerJoin(tutorials, eq(learningProgress.tutorialId, tutorials.id))
        .leftJoin(generatedApis, eq(users.id, generatedApis.userId))
        .leftJoin(billingRecords, eq(generatedApis.id, billingRecords.apiId))
        .leftJoin(apiUsage, eq(generatedApis.id, apiUsage.apiId))
        .where(eq(learningProgress.completed, true))
        .groupBy(users.id, users.name)
        .having(
          sql`count(distinct case when ${learningProgress.completed} = true then ${learningProgress.tutorialId} end) > 0`,
        )
        .orderBy(
          desc(
            sql`case when count(distinct ${generatedApis.id}) > 0 then (count(distinct case when ${generatedApis.status} = 'published' and ${billingRecords.amount} > 0 then ${generatedApis.id} end)::float / count(distinct ${generatedApis.id}) * 100) else 0 end`,
          ),
        );
    } catch (error) {
      await logError(
        "getLearningToApiSuccessCorrelation failed",
        error,
        "get_learning_to_api_success_correlation",
      );
      return [];
    }
  }

  // 決済フロー分析 - PaymentRequest から BillingRecord までの変換率
  async getPaymentFlowAnalysis() {
    try {
      return await this.db
        .select({
          // API Info
          apiId: generatedApis.id,
          apiName: generatedApis.name,
          apiPrice: generatedApis.price,

          // Payment Flow Metrics
          totalPaymentRequests:
            sql<number>`count(distinct ${paymentRequests.id})`.as(
              "total_payment_requests",
            ),
          pendingRequests:
            sql<number>`count(distinct case when ${paymentRequests.status} = 'pending' then ${paymentRequests.id} end)`.as(
              "pending_requests",
            ),
          completedRequests:
            sql<number>`count(distinct case when ${paymentRequests.status} = 'completed' then ${paymentRequests.id} end)`.as(
              "completed_requests",
            ),
          failedRequests:
            sql<number>`count(distinct case when ${paymentRequests.status} = 'failed' then ${paymentRequests.id} end)`.as(
              "failed_requests",
            ),
          expiredRequests:
            sql<number>`count(distinct case when ${paymentRequests.status} = 'expired' then ${paymentRequests.id} end)`.as(
              "expired_requests",
            ),

          // Conversion Rates
          completionRate:
            sql<number>`case when count(distinct ${paymentRequests.id}) > 0 then (count(distinct case when ${paymentRequests.status} = 'completed' then ${paymentRequests.id} end)::float / count(distinct ${paymentRequests.id}) * 100) else 0 end`.as(
              "completion_rate",
            ),
          failureRate:
            sql<number>`case when count(distinct ${paymentRequests.id}) > 0 then (count(distinct case when ${paymentRequests.status} = 'failed' then ${paymentRequests.id} end)::float / count(distinct ${paymentRequests.id}) * 100) else 0 end`.as(
              "failure_rate",
            ),

          // Revenue Conversion
          totalRequestedAmount:
            sql<string>`coalesce(sum(${paymentRequests.amount}), 0)`.as(
              "total_requested_amount",
            ),
          totalCollectedAmount:
            sql<string>`coalesce(sum(${billingRecords.amount}), 0)`.as(
              "total_collected_amount",
            ),
          revenueConversionRate:
            sql<number>`case when sum(${paymentRequests.amount}) > 0 then (sum(${billingRecords.amount})::float / sum(${paymentRequests.amount}) * 100) else 0 end`.as(
              "revenue_conversion_rate",
            ),

          // Timing Analysis
          avgTimeToComplete:
            sql<number>`avg(extract(epoch from ${billingRecords.createdAt} - ${paymentRequests.createdAt}) / 60)`.as(
              "avg_time_to_complete_minutes",
            ),
          avgTimeToExpire:
            sql<number>`avg(extract(epoch from ${paymentRequests.expiresAt} - ${paymentRequests.createdAt}) / 3600)`.as(
              "avg_time_to_expire_hours",
            ),

          // User Behavior
          uniquePayingUsers:
            sql<number>`count(distinct ${billingRecords.userId})`.as(
              "unique_paying_users",
            ),
        })
        .from(generatedApis)
        .leftJoin(paymentRequests, eq(generatedApis.id, paymentRequests.apiId))
        .leftJoin(
          billingRecords,
          and(
            eq(paymentRequests.apiId, billingRecords.apiId),
            eq(paymentRequests.userId, billingRecords.userId),
          ),
        )
        .groupBy(generatedApis.id, generatedApis.name, generatedApis.price)
        .orderBy(
          desc(
            sql`case when count(distinct ${paymentRequests.id}) > 0 then (count(distinct case when ${paymentRequests.status} = 'completed' then ${paymentRequests.id} end)::float / count(distinct ${paymentRequests.id}) * 100) else 0 end`,
          ),
        );
    } catch (error) {
      await logError(
        "getPaymentFlowAnalysis failed",
        error,
        "get_payment_flow_analysis",
      );
      return [];
    }
  }
}

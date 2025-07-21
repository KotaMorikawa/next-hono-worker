import { and, desc, eq, sql } from "drizzle-orm";
import {
  type LearningProgressDB,
  type NewLearningProgressDB,
  learningProgress,
} from "../../schema";
import type { Database } from "../../types";
import type { UserLearningStatistics, TutorialProgressStats } from "../../types/metrics";
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
// LEARNING PROGRESS OPERATIONS - 学習進捗管理
// =============================================================================

export class LearningProgressOperations {
  constructor(private db: Database) {}

  async create(data: NewLearningProgressDB): Promise<Result<LearningProgressDB>> {
    return tryAsync(async () => {
      const validationResult = validateRequired(data, ['userId', 'tutorialId']);
      if (!validationResult.success) {
        throw new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          validationResult.error.message
        );
      }

      const result = await this.db
        .insert(learningProgress)
        .values(data)
        .returning();
      const firstResult = getFirstResult(result, "Failed to create learning progress");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'create_learning_progress', data });
  }

  async findByUserAndTutorial(
    userId: string,
    tutorialId: string,
  ): Promise<Result<LearningProgressDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(learningProgress)
        .where(
          and(
            eq(learningProgress.userId, userId),
            eq(learningProgress.tutorialId, tutorialId),
          ),
        )
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_learning_progress', userId, tutorialId });
  }

  async updateProgress(
    userId: string,
    tutorialId: string,
    progress: number,
    timeSpent: number,
  ): Promise<Result<LearningProgressDB | null>> {
    return tryAsync(async () => {
      const completed = progress >= 100;

      const result = await this.db
        .insert(learningProgress)
        .values({
          userId,
          tutorialId,
          progress: Math.min(progress, 100),
          completed,
          timeSpent,
          lastAccessedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [learningProgress.userId, learningProgress.tutorialId],
          set: {
            progress: sql`greatest(${learningProgress.progress}, ${Math.min(
              progress,
              100,
            )})`,
            completed: sql`${learningProgress.completed} or ${completed}`,
            timeSpent: sql`${learningProgress.timeSpent} + ${timeSpent}`,
            lastAccessedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      return getFirstOrNull(result);
    }, { operation: 'update_learning_progress', userId, tutorialId, progress, timeSpent });
  }

  async getUserProgress(
    userId: string,
    limit?: number,
  ): Promise<Result<LearningProgressDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(learningProgress)
        .where(eq(learningProgress.userId, userId))
        .orderBy(desc(learningProgress.lastAccessedAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'get_user_progress', userId, limit });
  }

  async getCompletedByUser(userId: string): Promise<Result<LearningProgressDB[]>> {
    return tryAsync(async () => {
      return await this.db
        .select()
        .from(learningProgress)
        .where(
          and(
            eq(learningProgress.userId, userId),
            eq(learningProgress.completed, true),
          ),
        )
        .orderBy(desc(learningProgress.updatedAt));
    }, { operation: 'get_completed_progress', userId });
  }

  async getUserStatistics(userId: string): Promise<Result<UserLearningStatistics | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select({
          totalTutorials: sql<number>`count(*)`.as("total_tutorials"),
          completedTutorials:
            sql<number>`count(*) filter (where ${learningProgress.completed} = true)`.as(
              "completed_tutorials",
            ),
          totalTimeSpent:
            sql<number>`coalesce(sum(${learningProgress.timeSpent}), 0)`.as(
              "total_time_spent",
            ),
          averageProgress:
            sql<number>`coalesce(avg(${learningProgress.progress}), 0)`.as(
              "average_progress",
            ),
          lastActivity: sql<Date>`max(${learningProgress.lastAccessedAt})`.as(
            "last_activity",
          ),
        })
        .from(learningProgress)
        .where(eq(learningProgress.userId, userId));

      return getFirstOrNull(result);
    }, { operation: 'get_user_statistics', userId });
  }

  async getTutorialProgress(tutorialId: string): Promise<Result<TutorialProgressStats[]>> {
    return tryAsync(async () => {
      return await this.db
        .select({
          totalUsers: sql<number>`count(*)`.as("total_users"),
          completedUsers:
            sql<number>`count(*) filter (where ${learningProgress.completed} = true)`.as(
              "completed_users",
            ),
          averageProgress:
            sql<number>`coalesce(avg(${learningProgress.progress}), 0)`.as(
              "average_progress",
            ),
          averageTimeSpent:
            sql<number>`coalesce(avg(${learningProgress.timeSpent}), 0)`.as(
              "average_time_spent",
            ),
          completionRate:
            sql<number>`case when count(*) > 0 then (count(*) filter (where ${learningProgress.completed} = true)::float / count(*) * 100) else 0 end`.as(
              "completion_rate",
            ),
        })
        .from(learningProgress)
        .where(eq(learningProgress.tutorialId, tutorialId));
    }, { operation: 'get_tutorial_progress', tutorialId });
  }
}
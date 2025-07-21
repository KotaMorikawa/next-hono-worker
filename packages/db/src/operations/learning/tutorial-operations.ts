import { and, desc, eq, sql } from "drizzle-orm";
import {
  type NewTutorialDB,
  type TutorialDB,
  learningProgress,
  tutorials,
} from "../../schema";
import type { Database } from "../../types";
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
// TUTORIAL OPERATIONS - チュートリアル管理
// =============================================================================

export class TutorialOperations {
  constructor(private db: Database) {}

  async create(data: NewTutorialDB): Promise<Result<TutorialDB>> {
    return tryAsync(async () => {
      const validationResult = validateRequired(data, ['title', 'content']);
      if (!validationResult.success) {
        throw new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          validationResult.error.message
        );
      }

      const result = await this.db.insert(tutorials).values(data).returning();
      const firstResult = getFirstResult(result, "Failed to create tutorial");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'create_tutorial', data });
  }

  async findById(id: string): Promise<Result<TutorialDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(tutorials)
        .where(eq(tutorials.id, id))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_tutorial_by_id', id });
  }

  async findByCategory(
    category: string,
    limit?: number,
  ): Promise<Result<TutorialDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(tutorials)
        .where(eq(tutorials.category, category))
        .orderBy(desc(tutorials.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_tutorials_by_category', category, limit });
  }

  async findPublished(limit?: number): Promise<Result<TutorialDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(tutorials)
        .where(eq(tutorials.published, true))
        .orderBy(desc(tutorials.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_published_tutorials', limit });
  }

  async search(query: string, limit?: number): Promise<Result<TutorialDB[]>> {
    return tryAsync(async () => {
      const searchQuery = `%${query}%`;
      const searchDbQuery = this.db
        .select()
        .from(tutorials)
        .where(
          and(
            eq(tutorials.published, true),
            sql`(${tutorials.title} ilike ${searchQuery} or ${tutorials.description} ilike ${searchQuery})`,
          ),
        )
        .orderBy(desc(tutorials.createdAt));

      return limit ? await searchDbQuery.limit(limit) : await searchDbQuery;
    }, { operation: 'search_tutorials', query, limit });
  }

  async update(
    id: string,
    data: Partial<NewTutorialDB>,
  ): Promise<Result<TutorialDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .update(tutorials)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tutorials.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'update_tutorial', id, data });
  }

  async publish(id: string): Promise<Result<TutorialDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .update(tutorials)
        .set({ published: true, updatedAt: new Date() })
        .where(eq(tutorials.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'publish_tutorial', id });
  }

  async unpublish(id: string): Promise<Result<TutorialDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .update(tutorials)
        .set({ published: false, updatedAt: new Date() })
        .where(eq(tutorials.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'unpublish_tutorial', id });
  }

  async delete(id: string): Promise<Result<boolean>> {
    return tryAsync(async () => {
      const result = await this.db
        .delete(tutorials)
        .where(eq(tutorials.id, id))
        .returning();
      return result.length > 0;
    }, { operation: 'delete_tutorial', id });
  }

  async getRecommendations(
    userId: string,
    limit?: number,
  ): Promise<Result<TutorialDB[]>> {
    return tryAsync(async () => {
      // Get completed tutorials by user
      const completedTutorials = await this.db
        .select({ tutorialId: learningProgress.tutorialId })
        .from(learningProgress)
        .where(
          and(
            eq(learningProgress.userId, userId),
            eq(learningProgress.completed, true),
          ),
        );

      const completedIds = completedTutorials.map((t) => t.tutorialId);

      // Get recommendations based on similar users or category
      const query = this.db
        .select()
        .from(tutorials)
        .where(
          and(
            eq(tutorials.published, true),
            completedIds.length > 0
              ? sql`${tutorials.id} not in (${sql.join(completedIds, sql`, `)})`
              : sql`true`,
          ),
        )
        .orderBy(desc(tutorials.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'get_tutorial_recommendations', userId, limit });
  }
}
import { and, desc, eq, sql } from "drizzle-orm";
import {
  type ApiKeyDB,
  type NewApiKeyDB,
  apiKeys,
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
// API KEY OPERATIONS - APIキー管理
// =============================================================================

export class ApiKeyOperations {
  constructor(private db: Database) {}

  async create(data: NewApiKeyDB): Promise<Result<ApiKeyDB>> {
    return tryAsync(async () => {
      const validationResult = validateRequired(data, ['name', 'keyHash', 'userId']);
      if (!validationResult.success) {
        throw new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          validationResult.error.message
        );
      }

      const result = await this.db.insert(apiKeys).values(data).returning();
      const firstResult = getFirstResult(result, "Failed to create API key");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'create_api_key', data });
  }

  async findById(id: string): Promise<Result<ApiKeyDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, id))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_api_key_by_id', id });
  }

  async findByKeyHash(keyHash: string): Promise<Result<ApiKeyDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_api_key_by_hash', keyHash });
  }

  async findByUser(userId: string, limit?: number): Promise<Result<ApiKeyDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .orderBy(desc(apiKeys.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_api_keys_by_user', userId, limit });
  }

  async update(
    id: string,
    data: Partial<NewApiKeyDB>,
  ): Promise<Result<ApiKeyDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .update(apiKeys)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(apiKeys.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'update_api_key', id, data });
  }

  async updateLastUsed(id: string): Promise<Result<void>> {
    return tryAsync(async () => {
      await this.db
        .update(apiKeys)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(apiKeys.id, id));
    }, { operation: 'update_api_key_last_used', id });
  }

  async delete(id: string): Promise<Result<boolean>> {
    return tryAsync(async () => {
      const result = await this.db
        .delete(apiKeys)
        .where(eq(apiKeys.id, id))
        .returning();
      return result.length > 0;
    }, { operation: 'delete_api_key', id });
  }

  async findExpired(): Promise<Result<ApiKeyDB[]>> {
    return tryAsync(async () => {
      const now = new Date();
      return await this.db
        .select()
        .from(apiKeys)
        .where(
          and(
            sql`${apiKeys.expiresAt} IS NOT NULL`,
            sql`${apiKeys.expiresAt} < ${now}`,
          ),
        );
    }, { operation: 'find_expired_api_keys' });
  }
}
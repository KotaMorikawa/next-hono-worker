import { desc, eq } from "drizzle-orm";
import {
  type NewUserDB,
  type UserDB,
  users,
} from "../../schema";
import type { Database } from "../../types";
import {
  getFirstOrNull,
  getFirstResult,
  type Result,
  tryAsync,
} from "../../utils/result";
import { validateWithSchema } from "../../utils/validation";
import { createUserSchema } from "../../schemas/validation";

// =============================================================================
// USER OPERATIONS - ユーザー管理
// =============================================================================

export class UserOperations {
  constructor(private db: Database) {}

  async create(data: NewUserDB): Promise<Result<UserDB>> {
    return tryAsync(
      async () => {
        const validationResult = validateWithSchema(createUserSchema, data, { operation: "create_user" });
        if (!validationResult.success) {
          throw validationResult.error;
        }

        const insertData = {
          ...validationResult.data,
          organizationId: validationResult.data.organizationId || null,
          emailVerified: validationResult.data.emailVerified ?? false,
        };
        const result = await this.db.insert(users).values(insertData).returning();
        const firstResult = getFirstResult(result, `Failed to create user`);
        if (!firstResult.success) {
          throw firstResult.error;
        }
        return firstResult.data;
      },
      { operation: "create_user", data },
    );
  }

  async findById(id: string): Promise<Result<UserDB | null>> {
    return tryAsync(
      async () => {
        const result = await this.db
          .select()
          .from(users)
          .where(eq(users.id, id))
          .limit(1);
        return getFirstOrNull(result);
      },
      { operation: "find_user_by_id", id },
    );
  }

  async findByEmail(email: string): Promise<Result<UserDB | null>> {
    return tryAsync(
      async () => {
        const result = await this.db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        return getFirstOrNull(result);
      },
      { operation: "find_user_by_email", email },
    );
  }

  async update(
    id: string,
    data: Partial<NewUserDB>,
  ): Promise<Result<UserDB | null>> {
    return tryAsync(
      async () => {
        const result = await this.db
          .update(users)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning();
        return getFirstOrNull(result);
      },
      { operation: "update_user", id, data },
    );
  }

  async delete(id: string): Promise<Result<boolean>> {
    return tryAsync(
      async () => {
        const result = await this.db
          .delete(users)
          .where(eq(users.id, id))
          .returning();
        return result.length > 0;
      },
      { operation: "delete_user", id },
    );
  }

  async findByOrganization(
    organizationId: string,
    limit?: number,
  ): Promise<Result<UserDB[]>> {
    return tryAsync(
      async () => {
        const query = this.db
          .select()
          .from(users)
          .where(eq(users.organizationId, organizationId))
          .orderBy(desc(users.createdAt));

        return limit ? await query.limit(limit) : await query;
      },
      { operation: "find_users_by_organization", organizationId, limit },
    );
  }
}
import { desc, eq } from "drizzle-orm";
import {
  type NewOrganizationDB,
  type OrganizationDB,
  organizations,
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
// ORGANIZATION OPERATIONS - 組織管理
// =============================================================================

export class OrganizationOperations {
  constructor(private db: Database) {}

  async create(data: NewOrganizationDB): Promise<Result<OrganizationDB>> {
    return tryAsync(
      async () => {
        const validationResult = validateRequired(data, ["name"]);
        if (!validationResult.success) {
          throw new DatabaseError(
            DatabaseErrorType.VALIDATION_ERROR,
            validationResult.error.message,
          );
        }

        const result = await this.db
          .insert(organizations)
          .values(data)
          .returning();
        const firstResult = getFirstResult(
          result,
          `Failed to create organization`,
        );
        if (!firstResult.success) {
          throw firstResult.error;
        }
        return firstResult.data;
      },
      { operation: "create_organization", data },
    );
  }

  async findById(id: string): Promise<Result<OrganizationDB | null>> {
    return tryAsync(
      async () => {
        const result = await this.db
          .select()
          .from(organizations)
          .where(eq(organizations.id, id))
          .limit(1);
        return getFirstOrNull(result);
      },
      { operation: "find_organization_by_id", id },
    );
  }

  async findByDomain(domain: string): Promise<Result<OrganizationDB | null>> {
    return tryAsync(
      async () => {
        const result = await this.db
          .select()
          .from(organizations)
          .where(eq(organizations.domain, domain))
          .limit(1);
        return getFirstOrNull(result);
      },
      { operation: "find_organization_by_domain", domain },
    );
  }

  async update(
    id: string,
    data: Partial<NewOrganizationDB>,
  ): Promise<Result<OrganizationDB | null>> {
    return tryAsync(
      async () => {
        const result = await this.db
          .update(organizations)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(organizations.id, id))
          .returning();
        return getFirstOrNull(result);
      },
      { operation: "update_organization", id, data },
    );
  }

  async delete(id: string): Promise<Result<boolean>> {
    return tryAsync(
      async () => {
        const result = await this.db
          .delete(organizations)
          .where(eq(organizations.id, id))
          .returning();
        return result.length > 0;
      },
      { operation: "delete_organization", id },
    );
  }

  async list(limit?: number): Promise<Result<OrganizationDB[]>> {
    return tryAsync(
      async () => {
        const query = this.db
          .select()
          .from(organizations)
          .orderBy(desc(organizations.createdAt));

        return limit ? await query.limit(limit) : await query;
      },
      { operation: "list_organizations", limit },
    );
  }
}
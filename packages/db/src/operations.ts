// Simple database operations with basic validation

import { eq } from "drizzle-orm";
import { apiKeys, organizations, users } from "./schema";
import type { Database } from "./types";
import {
  type ValidationResult,
  validateApiKeyCreation,
  validateUserRegistration,
} from "./validation";

// Basic user operations
export class UserOperations {
  constructor(private db: Database) {}

  async findById(id: string) {
    return this.db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        organization: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: eq(users.email, email),
      with: {
        organization: true,
      },
    });
  }

  async createFromRegistration(
    data: unknown,
  ): Promise<ValidationResult<{ id: string }>> {
    const validation = validateUserRegistration(data);
    if (!validation.success) {
      return validation;
    }

    try {
      const [result] = await this.db
        .insert(users)
        .values({
          email: validation.data.email,
          name: validation.data.name,
          passwordHash: "", // This would be hashed in the auth layer
          emailVerified: false,
        })
        .returning({ id: users.id });

      if (!result) {
        return { success: false, error: "Failed to create user" };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Database operation failed",
      };
    }
  }
}

// Basic organization operations
export class OrganizationOperations {
  constructor(private db: Database) {}

  async findById(id: string) {
    return this.db.query.organizations.findFirst({
      where: eq(organizations.id, id),
      with: {
        users: true,
      },
    });
  }
}

// Basic API key operations
export class ApiKeyOperations {
  constructor(private db: Database) {}

  async findByUserId(userId: string) {
    return this.db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, userId),
    });
  }

  async createForUser(
    userId: string,
    data: unknown,
  ): Promise<ValidationResult<{ id: string }>> {
    const validation = validateApiKeyCreation(data);
    if (!validation.success) {
      return validation;
    }

    try {
      const [result] = await this.db
        .insert(apiKeys)
        .values({
          name: validation.data.name,
          description: validation.data.description || null,
          keyHash: "", // This would be generated in the API layer
          keyPrefix: "", // This would be generated in the API layer
          userId: userId,
          expiresAt: validation.data.expiresAt || null,
        })
        .returning({ id: apiKeys.id });

      if (!result) {
        return { success: false, error: "Failed to create API key" };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Database operation failed",
      };
    }
  }
}

// Database operations factory
export function createDatabaseOperations(db: Database) {
  return {
    users: new UserOperations(db),
    organizations: new OrganizationOperations(db),
    apiKeys: new ApiKeyOperations(db),
  };
}

export type DatabaseOperations = ReturnType<typeof createDatabaseOperations>;

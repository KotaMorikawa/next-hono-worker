import type { Database } from "../types";
import { DatabaseAnalytics } from "./analytics";
import {
  ApiUsageOperations,
  BillingRecordOperations,
  GeneratedApiOperations,
  PaymentRequestOperations,
} from "./api-billing";
// Domain-based imports
import {
  ApiKeyOperations,
  OrganizationOperations,
  UserOperations,
} from "./authentication";
import { CrossTableQueries } from "./cross-table";
import { LearningProgressOperations, TutorialOperations } from "./learning";
import { SimulationActionOperations, SimulationOperations } from "./simulation";
import { TransactionProcessor } from "./transactions";

// Re-export all classes
export {
  UserOperations,
  OrganizationOperations,
  ApiKeyOperations,
  LearningProgressOperations,
  TutorialOperations,
  GeneratedApiOperations,
  PaymentRequestOperations,
  BillingRecordOperations,
  ApiUsageOperations,
  SimulationOperations,
  SimulationActionOperations,
  DatabaseAnalytics,
  CrossTableQueries,
  TransactionProcessor,
};

// =============================================================================
// DATABASE OPERATIONS FACTORY
// =============================================================================

/**
 * Creates a complete database operations instance with all operation classes
 * Organized by domain-driven architecture
 *
 * @param db - Database instance
 * @returns Object containing all operation classes organized by domain
 */
export function createDatabaseOperations(db: Database) {
  return {
    // Authentication & Organization Domain
    users: new UserOperations(db),
    organizations: new OrganizationOperations(db),
    apiKeys: new ApiKeyOperations(db),

    // Learning Domain
    learningProgress: new LearningProgressOperations(db),
    tutorials: new TutorialOperations(db),

    // API & Billing Domain
    generatedApis: new GeneratedApiOperations(db),
    paymentRequests: new PaymentRequestOperations(db),
    billingRecords: new BillingRecordOperations(db),
    apiUsage: new ApiUsageOperations(db),

    // Simulation Domain
    simulations: new SimulationOperations(db),
    simulationActions: new SimulationActionOperations(db),

    // Analytics and Complex Queries
    analytics: new DatabaseAnalytics(db),
    crossTableQueries: new CrossTableQueries(db),
    transactionProcessor: new TransactionProcessor(db),
  };
}

/**
 * Type definition for the complete database operations object
 */
export type DatabaseOperations = ReturnType<typeof createDatabaseOperations>;

// Type definitions are exported implicitly through the class exports above

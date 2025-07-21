// =============================================================================
// DATABASE OPERATION VALIDATION SCHEMAS
// =============================================================================

import { z } from "zod";

// =============================================================================
// USER & ORGANIZATION SCHEMAS
// =============================================================================

export const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  passwordHash: z.string().min(1, "Password hash is required"),
  organizationId: z.string().uuid("Invalid organization ID").nullable().optional(),
  emailVerified: z.boolean().default(false),
});

export const updateUserSchema = createUserSchema.partial();

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(255, "Name too long"),
  domain: z.string().max(255, "Domain too long").optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// =============================================================================
// API KEY SCHEMAS
// =============================================================================

export const createApiKeySchema = z.object({
  name: z.string().min(1, "API key name is required").max(255, "Name too long"),
  description: z.string().optional(),
  keyHash: z.string().min(1, "Key hash is required"),
  keyPrefix: z.string().min(1, "Key prefix is required").max(10, "Prefix too long"),
  userId: z.string().uuid("Invalid user ID"),
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  expiresAt: z.date().optional(),
});

export const updateApiKeySchema = createApiKeySchema.partial();

// =============================================================================
// GENERATED API SCHEMAS
// =============================================================================

export const createGeneratedApiSchema = z.object({
  name: z.string().min(1, "API name is required").max(255, "Name too long"),
  description: z.string().min(1, "Description is required"),
  endpoint: z.string().min(1, "Endpoint is required").max(500, "Endpoint too long"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"], {
    errorMap: () => ({ message: "Invalid HTTP method" })
  }),
  price: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid price format"),
  currency: z.literal("USDC"),
  generatedCode: z.string().min(1, "Generated code is required"),
  testCode: z.string().optional(),
  documentation: z.string().min(1, "Documentation is required"),
  status: z.enum(["draft", "testing", "active", "deprecated"]).default("draft"),
  userId: z.string().uuid("Invalid user ID"),
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateGeneratedApiSchema = createGeneratedApiSchema.partial();

// =============================================================================
// PAYMENT REQUEST SCHEMAS
// =============================================================================

export const createPaymentRequestSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  apiId: z.string().uuid("Invalid API ID"),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid amount format"),
  currency: z.literal("USDC"),
  walletAddress: z.string().min(1, "Wallet address is required"),
  metadata: z.record(z.unknown()).optional(),
  expiresAt: z.date().optional(),
});

export const updatePaymentRequestSchema = z.object({
  status: z.enum(["pending", "completed", "failed", "expired"]),
  transactionHash: z.string().optional(),
  blockNumber: z.number().int().positive().optional(),
});

// =============================================================================
// BILLING RECORD SCHEMAS
// =============================================================================

export const createBillingRecordSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  apiId: z.string().uuid("Invalid API ID"),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid amount format"),
  currency: z.literal("USDC"),
  transactionHash: z.string().min(1, "Transaction hash is required"),
  blockNumber: z.number().int().positive("Invalid block number"),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// API USAGE SCHEMAS
// =============================================================================

export const createApiUsageSchema = z.object({
  apiId: z.string().uuid("Invalid API ID"),
  userId: z.string().uuid("Invalid user ID"),
  requestCount: z.number().int().nonnegative("Invalid request count"),
  totalRevenue: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid revenue format"),
  averageResponseTime: z.number().nonnegative("Invalid response time"),
  errorCount: z.number().int().nonnegative("Invalid error count"),
  date: z.date(),
});

export const updateApiUsageSchema = z.object({
  requestCount: z.number().int().positive("Invalid request count"),
  errorCount: z.number().int().nonnegative("Invalid error count"),
  responseTime: z.number().positive("Invalid response time"),
});

// =============================================================================
// TUTORIAL SCHEMAS
// =============================================================================

export const createTutorialSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().min(1, "Description is required"),
  content: z.string().min(1, "Content is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedTime: z.number().int().positive("Invalid estimated time"),
  category: z.enum(["x402", "api-creation", "blockchain", "payments"]),
  prerequisites: z.array(z.string().uuid()).optional(),
});

export const updateTutorialSchema = createTutorialSchema.partial();

// =============================================================================
// LEARNING PROGRESS SCHEMAS
// =============================================================================

export const createLearningProgressSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  tutorialId: z.string().uuid("Invalid tutorial ID"),
  progress: z.number().min(0, "Progress cannot be negative").max(100, "Progress cannot exceed 100").default(0),
  completed: z.boolean().default(false),
  timeSpent: z.number().int().nonnegative("Invalid time spent").default(0),
  lastAccessedAt: z.date().default(() => new Date()),
});

export const updateLearningProgressSchema = z.object({
  progress: z.number().min(0).max(100),
  timeSpent: z.number().int().nonnegative(),
});

// =============================================================================
// SIMULATION SCHEMAS
// =============================================================================

export const createSimulationSchema = z.object({
  scenarioType: z.string().min(1, "Scenario type is required"),
  userId: z.string().uuid("Invalid user ID"),
  currentStep: z.number().int().nonnegative("Invalid current step").default(0),
  totalSteps: z.number().int().positive("Invalid total steps").optional(),
  completed: z.boolean().default(false),
  walletState: z.record(z.unknown()).optional(),
  apiState: z.record(z.unknown()).optional(),
});

export const updateSimulationSchema = z.object({
  currentStep: z.number().int().nonnegative(),
  walletState: z.record(z.unknown()).optional(),
  apiState: z.record(z.unknown()).optional(),
  completed: z.boolean().optional(),
});

// =============================================================================
// SIMULATION ACTION SCHEMAS
// =============================================================================

export const createSimulationActionSchema = z.object({
  simulationId: z.string().uuid("Invalid simulation ID"),
  actionType: z.string().min(1, "Action type is required"),
  stepNumber: z.number().int().nonnegative("Invalid step number"),
  actionData: z.record(z.unknown()).optional(),
  result: z.record(z.unknown()).optional(),
  success: z.boolean().default(true),
});

// =============================================================================
// COMMON VALIDATION HELPERS
// =============================================================================

export const uuidSchema = z.string().uuid("Invalid UUID format");
export const emailSchema = z.string().email("Invalid email format");
export const positiveIntSchema = z.number().int().positive("Must be a positive integer");
export const nonNegativeIntSchema = z.number().int().nonnegative("Must be non-negative");
export const decimalStringSchema = z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid decimal format");

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
export type CreateGeneratedApiInput = z.infer<typeof createGeneratedApiSchema>;
export type UpdateGeneratedApiInput = z.infer<typeof updateGeneratedApiSchema>;
export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestSchema>;
export type UpdatePaymentRequestInput = z.infer<typeof updatePaymentRequestSchema>;
export type CreateBillingRecordInput = z.infer<typeof createBillingRecordSchema>;
export type CreateApiUsageInput = z.infer<typeof createApiUsageSchema>;
export type UpdateApiUsageInput = z.infer<typeof updateApiUsageSchema>;
export type CreateTutorialInput = z.infer<typeof createTutorialSchema>;
export type UpdateTutorialInput = z.infer<typeof updateTutorialSchema>;
export type CreateLearningProgressInput = z.infer<typeof createLearningProgressSchema>;
export type UpdateLearningProgressInput = z.infer<typeof updateLearningProgressSchema>;
export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;
export type UpdateSimulationInput = z.infer<typeof updateSimulationSchema>;
export type CreateSimulationActionInput = z.infer<typeof createSimulationActionSchema>;
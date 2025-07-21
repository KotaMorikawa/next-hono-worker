import { z } from "zod";

// API Key management schemas
export const createApiKeySchema = z.object({
  name: z.string().min(1, "API key name is required"),
  description: z.string().optional(),
  expiresAt: z.date().optional(),
});

export const apiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  key: z.string(),
  userId: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  expiresAt: z.date().nullable(),
  lastUsedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Natural language API generation schemas
export const naturalLanguageInputSchema = z.object({
  description: z.string().min(10, "Please provide a detailed description"),
  category: z.enum(["data", "utility", "integration", "ai", "other"]),
  expectedPrice: z.string().optional(),
  externalApis: z.array(z.string()).optional(),
  complexityLevel: z.enum(["simple", "medium", "complex"]).default("medium"),
  autoDeploy: z.boolean().optional().default(true),
});

export const generatedApiSpecSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  endpoint: z.string(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  price: z.string(),
  currency: z.literal("USDC"),
  generatedCode: z.string(),
  testCode: z.string().optional(),
  documentation: z.string(),
  status: z.enum(["draft", "testing", "active", "deprecated"]),
  userId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// API usage tracking schemas
export const usageStatsSchema = z.object({
  apiId: z.string().uuid(),
  userId: z.string().uuid(),
  requestCount: z.number().int().nonnegative(),
  totalRevenue: z.string(),
  averageResponseTime: z.number().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  date: z.date(),
});

export const billingRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  apiId: z.string().uuid(),
  amount: z.string(),
  currency: z.literal("USDC"),
  transactionHash: z.string(),
  blockNumber: z.number().int().positive(),
  createdAt: z.date(),
});

// Learning content schemas
export const tutorialSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  content: z.string(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedTime: z.number().int().positive(),
  category: z.enum(["x402", "api-creation", "blockchain", "payments"]),
  prerequisites: z.array(z.string().uuid()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const learningProgressSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tutorialId: z.string().uuid(),
  progress: z.number().min(0).max(100),
  completed: z.boolean(),
  timeSpent: z.number().int().nonnegative(),
  lastAccessedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Type exports
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type NaturalLanguageInput = z.infer<typeof naturalLanguageInputSchema>;
export type GeneratedApiSpec = z.infer<typeof generatedApiSpecSchema>;
export type UsageStats = z.infer<typeof usageStatsSchema>;
export type BillingRecord = z.infer<typeof billingRecordSchema>;
export type Tutorial = z.infer<typeof tutorialSchema>;
export type LearningProgress = z.infer<typeof learningProgressSchema>;

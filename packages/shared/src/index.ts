// Re-export all schemas and types

export * from "./api";
export * from "./auth";
export * from "./x402";

// Additional schema exports (non-conflicting with existing files)
export {
  // Usage & Billing schemas
  PaymentStatus,
  BillingPeriod,
  billingSchema,
  usageAggregationSchema,
  usageReportSchema,
  type BillingInput,
  type BillingBreakdownItem,
  type UsageAggregationInput,
  type UsageReport,
} from "./schemas/usage-billing";

export {
  // Learning schemas
  DifficultyLevel,
  TutorialCategory,
  CompletionStatus,
  progressSchema,
  learningStatsSchema,
  tutorialSearchSchema,
  type ProgressInput,
  type LearningStats,
  type TutorialSearchInput,
  type TutorialStep,
} from "./schemas/learning";

export {
  // LLM Integration schemas  
  LLMProvider,
  ProgrammingLanguage,
  Framework,
  GenerationStatus,
  generatedCodeSchema,
  codeEvaluationSchema,
  codeImprovementRequestSchema,
  codeSearchSchema,
  type GeneratedCode,
  type CodeEvaluationInput,
  type CodeImprovementRequest,
  type CodeSearchInput,
  type CodeDependency,
} from "./schemas/llm-integration";

// Common utility types
export type Result<T, E = Error> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: E;
    };

export type PaginationParams = {
  page: number;
  limit: number;
  offset: number;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

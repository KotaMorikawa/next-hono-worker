import { describe, it, expect } from 'vitest';
import {
  // Auth schemas
  loginSchema,
  registerSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  
  // API management (from existing api.ts)
  createApiKeySchema,
  naturalLanguageInputSchema,
  usageStatsSchema,
  
  // Additional schemas
  billingSchema,
  progressSchema,
  generatedCodeSchema,
  type LoginInput,
  type RegisterInput,
  type BillingInput,
  type ProgressInput,
} from '../../index';

describe('Schema Integration Tests', () => {
  describe('Auth Schema Validation', () => {
    it('should validate correct login data', () => {
      const validLogin: LoginInput = {
        email: 'test@example.com',
        password: 'TestPass123!',
      };
      
      expect(() => loginSchema.parse(validLogin)).not.toThrow();
    });

    it('should reject invalid email format', () => {
      const invalidLogin = {
        email: 'invalid-email',
        password: 'TestPass123!',
      };
      
      expect(() => loginSchema.parse(invalidLogin)).toThrow();
    });

    it('should validate complete register data', () => {
      const validRegister: RegisterInput = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        name: 'Test User',
        organizationName: 'Test Organization',
      };
      
      expect(() => registerSchema.parse(validRegister)).not.toThrow();
    });

    it('should reject password mismatch', () => {
      const invalidRegister = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!',
        name: 'Test User',
      };
      
      expect(() => registerSchema.parse(invalidRegister)).toThrow();
    });

    it('should validate password reset request', () => {
      const validRequest = {
        email: 'user@example.com',
      };
      
      expect(() => passwordResetRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should validate password reset with token', () => {
      const validReset = {
        token: 'reset-token-123',
        password: 'NewSecurePass123!',
      };
      
      expect(() => passwordResetSchema.parse(validReset)).not.toThrow();
    });
  });

  describe('API Management Schema Validation', () => {
    it('should validate API key creation', () => {
      const validApiKey = {
        name: 'Test API Key',
        description: 'Key for testing',
        expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      };
      
      expect(() => createApiKeySchema.parse(validApiKey)).not.toThrow();
    });

    it('should validate natural language input', () => {
      const validInput = {
        description: 'Create an API that returns weather data for a given city',
        category: 'data' as const,
        complexityLevel: 'medium' as const,
      };
      
      expect(() => naturalLanguageInputSchema.parse(validInput)).not.toThrow();
    });

    it('should validate usage stats', () => {
      const validStats = {
        apiId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        requestCount: 100,
        totalRevenue: '5.25',
        averageResponseTime: 250.5,
        errorCount: 2,
        date: new Date(),
      };
      
      expect(() => usageStatsSchema.parse(validStats)).not.toThrow();
    });
  });

  describe('Billing Schema Validation', () => {
    it('should validate complete billing record', () => {
      const validBilling: BillingInput = {
        userId: 'user-123',
        period: 'monthly',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalCost: 125.50,
        breakdowns: [
          {
            apiId: 'api-1',
            apiName: 'Weather API',
            requestCount: 1000,
            unitPrice: 0.05,
            totalCost: 50.00,
          },
          {
            apiId: 'api-2', 
            apiName: 'Currency API',
            requestCount: 1510,
            unitPrice: 0.05,
            totalCost: 75.50,
          },
        ],
        paymentStatus: 'completed',
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        createdAt: new Date(),
        paidAt: new Date(),
      };
      
      expect(() => billingSchema.parse(validBilling)).not.toThrow();
    });

    it('should reject invalid transaction hash', () => {
      const invalidBilling = {
        userId: 'user-123',
        period: 'monthly',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalCost: 125.50,
        breakdowns: [],
        paymentStatus: 'completed',
        transactionHash: 'invalid-hash',
        createdAt: new Date(),
      };
      
      expect(() => billingSchema.parse(invalidBilling)).toThrow();
    });
  });

  describe('Learning Progress Schema Validation', () => {
    it('should validate learning progress', () => {
      const validProgress: ProgressInput = {
        userId: 'user-123',
        tutorialId: 'tutorial-456',
        completedSteps: ['step-1', 'step-2'],
        totalSteps: 5,
        status: 'in_progress',
        startedAt: new Date('2024-01-01'),
        lastAccessedAt: new Date(),
        timeSpent: 45, // minutes
        notes: 'Making good progress on x402 basics',
      };
      
      expect(() => progressSchema.parse(validProgress)).not.toThrow();
    });

    it('should reject invalid completion status', () => {
      const invalidProgress = {
        userId: 'user-123',
        tutorialId: 'tutorial-456',
        completedSteps: [],
        totalSteps: 5,
        status: 'invalid_status',
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        timeSpent: 0,
      };
      
      expect(() => progressSchema.parse(invalidProgress)).toThrow();
    });
  });

  describe('LLM Integration Schema Validation', () => {
    it('should validate generated code', () => {
      const validCode = {
        id: 'code-123',
        sourcePrompt: 'Create a simple API for user authentication',
        code: 'export const authApi = new Hono()...',
        language: 'typescript',
        framework: 'hono',
        dependencies: [
          {
            name: 'hono',
            version: '^3.0.0',
            description: 'Lightweight web framework',
          },
        ],
        executionTime: 2500,
        llmProvider: 'gemini-pro',
        status: 'completed',
        qualityScore: 85,
        testCode: 'describe("auth api", () => { ... })',
        documentation: '# Authentication API\n\nThis API provides...',
        createdAt: new Date(),
        lastModifiedAt: new Date(),
      };
      
      expect(() => generatedCodeSchema.parse(validCode)).not.toThrow();
    });

    it('should reject execution time exceeding limit', () => {
      const invalidCode = {
        id: 'code-123',
        sourcePrompt: 'Create a complex API',
        code: 'export const api = new Hono()...',
        language: 'typescript',
        framework: 'hono',
        dependencies: [],
        executionTime: 400000, // Exceeds 5 minute limit
        llmProvider: 'gemini-pro',
        status: 'completed',
        createdAt: new Date(),
        lastModifiedAt: new Date(),
      };
      
      expect(() => generatedCodeSchema.parse(invalidCode)).toThrow();
    });
  });

  describe('Cross-Schema Type Safety', () => {
    it('should ensure type compatibility between related schemas', () => {
      // Test that userId from auth can be used in other schemas
      const userId = 'user-123e4567-e89b-12d3-a456-426614174000';
      
      const progress: ProgressInput = {
        userId,
        tutorialId: 'tutorial-456',
        completedSteps: [],
        totalSteps: 1,
        status: 'not_started',
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        timeSpent: 0,
      };
      
      const billing: BillingInput = {
        userId,
        period: 'monthly',
        startDate: new Date(),
        endDate: new Date(),
        totalCost: 0,
        breakdowns: [],
        paymentStatus: 'pending',
        createdAt: new Date(),
      };
      
      expect(() => progressSchema.parse(progress)).not.toThrow();
      expect(() => billingSchema.parse(billing)).not.toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should validate schemas within acceptable time limits', () => {
      const startTime = performance.now();
      
      // Run multiple validations
      for (let i = 0; i < 1000; i++) {
        loginSchema.parse({
          email: `test${i}@example.com`,
          password: 'TestPass123!',
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete 1000 validations in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle memory efficiently with large datasets', () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => ({
        userId: `user-${i}`,
        tutorialId: `tutorial-${i}`,
        completedSteps: [`step-${i}-1`, `step-${i}-2`],
        totalSteps: 10,
        status: 'in_progress' as const,
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        timeSpent: i * 5,
      }));
      
      expect(() => {
        largeArray.forEach(item => progressSchema.parse(item));
      }).not.toThrow();
    });
  });
});
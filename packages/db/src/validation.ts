// Simple database validation layer using Zod schemas from @repo/shared

import {
  createApiKeySchema,
  naturalLanguageInputSchema,
  registerSchema,
} from "@repo/shared";

// Validation helper type
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Simple validation function
export function validateWith<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown,
): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

// Common validation functions
export const validateUserRegistration = (data: unknown) =>
  validateWith(registerSchema, data);

export const validateApiKeyCreation = (data: unknown) =>
  validateWith(createApiKeySchema, data);

export const validateNaturalLanguageInput = (data: unknown) =>
  validateWith(naturalLanguageInputSchema, data);

// Database operation with validation
export async function withValidation<TInput, TOutput>(
  data: unknown,
  validator: (data: unknown) => ValidationResult<TInput>,
  operation: (validatedData: TInput) => Promise<TOutput>,
): Promise<ValidationResult<TOutput>> {
  const validation = validator(data);

  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  try {
    const result = await operation(validation.data);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Database operation failed",
    };
  }
}

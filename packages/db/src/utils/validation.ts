// =============================================================================
// ENHANCED VALIDATION UTILITIES FOR RESULT<T> PATTERN
// =============================================================================

import { z } from "zod";
import { DatabaseError, DatabaseErrorType, type Result } from "./result";

/**
 * Enhanced validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: DatabaseError };

/**
 * Validate data using Zod schema and return Result<T> pattern
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: Record<string, unknown>,
): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      
      return {
        success: false,
        error: new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          `Validation failed: ${errorMessage}`,
          error,
          { zodErrors: error.errors, ...context }
        ),
      };
    }
    
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        "Unknown validation error",
        error,
        context
      ),
    };
  }
}

/**
 * Validate required fields with custom error messages
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  data: T,
  requiredFields: (keyof T)[],
  context?: Record<string, unknown>,
): ValidationResult<T> {
  const missingFields = requiredFields.filter(
    (field) => data[field] === undefined || data[field] === null || data[field] === ""
  );

  if (missingFields.length > 0) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(", ")}`,
        undefined,
        { missingFields, providedData: data, ...context }
      ),
    };
  }

  return { success: true, data };
}

/**
 * Validate UUID format
 */
export function validateUUID(
  value: unknown,
  fieldName: string = "ID",
): ValidationResult<string> {
  if (typeof value !== "string") {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be a string`,
        undefined,
        { field: fieldName, value, type: typeof value }
      ),
    };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(value)) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be a valid UUID`,
        undefined,
        { field: fieldName, value }
      ),
    };
  }

  return { success: true, data: value };
}

/**
 * Validate email format
 */
export function validateEmail(email: unknown): ValidationResult<string> {
  if (typeof email !== "string") {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        "Email must be a string",
        undefined,
        { email, type: typeof email }
      ),
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        "Invalid email format",
        undefined,
        { email }
      ),
    };
  }

  return { success: true, data: email };
}

/**
 * Validate decimal string (for prices/amounts)
 */
export function validateDecimalString(
  value: unknown,
  fieldName: string = "amount",
): ValidationResult<string> {
  if (typeof value !== "string") {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be a string`,
        undefined,
        { field: fieldName, value, type: typeof value }
      ),
    };
  }

  const decimalRegex = /^\d+(\.\d{1,6})?$/;
  
  if (!decimalRegex.test(value)) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be a valid decimal string (up to 6 decimal places)`,
        undefined,
        { field: fieldName, value }
      ),
    };
  }

  return { success: true, data: value };
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(
  value: unknown,
  fieldName: string = "number",
): ValidationResult<number> {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be an integer`,
        undefined,
        { field: fieldName, value, type: typeof value }
      ),
    };
  }

  if (value <= 0) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be positive`,
        undefined,
        { field: fieldName, value }
      ),
    };
  }

  return { success: true, data: value };
}

/**
 * Validate non-negative number
 */
export function validateNonNegativeNumber(
  value: unknown,
  fieldName: string = "number",
): ValidationResult<number> {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be a number`,
        undefined,
        { field: fieldName, value, type: typeof value }
      ),
    };
  }

  if (value < 0) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} cannot be negative`,
        undefined,
        { field: fieldName, value }
      ),
    };
  }

  return { success: true, data: value };
}

/**
 * Validate string length constraints
 */
export function validateStringLength(
  value: unknown,
  fieldName: string,
  minLength: number = 1,
  maxLength: number = 255,
): ValidationResult<string> {
  if (typeof value !== "string") {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be a string`,
        undefined,
        { field: fieldName, value, type: typeof value }
      ),
    };
  }

  if (value.length < minLength) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be at least ${minLength} characters long`,
        undefined,
        { field: fieldName, value, length: value.length, minLength }
      ),
    };
  }

  if (value.length > maxLength) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be no more than ${maxLength} characters long`,
        undefined,
        { field: fieldName, value: `${value.substring(0, 50)}...`, length: value.length, maxLength }
      ),
    };
  }

  return { success: true, data: value };
}

/**
 * Validate enum values
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string,
): ValidationResult<T> {
  if (typeof value !== "string") {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be a string`,
        undefined,
        { field: fieldName, value, type: typeof value, allowedValues }
      ),
    };
  }

  if (!allowedValues.includes(value as T)) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `${fieldName} must be one of: ${allowedValues.join(", ")}`,
        undefined,
        { field: fieldName, value, allowedValues }
      ),
    };
  }

  return { success: true, data: value as T };
}

/**
 * Combine multiple validation results
 */
export function combineValidations<T extends Record<string, unknown>>(
  validations: Array<{ key: keyof T; result: ValidationResult<T[keyof T]> }>,
): ValidationResult<T> {
  const errors: string[] = [];
  const data: Partial<T> = {};

  for (const { key, result } of validations) {
    if (result.success) {
      data[key] = result.data;
    } else {
      errors.push(result.error.message);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `Multiple validation errors: ${errors.join("; ")}`,
        undefined,
        { errors }
      ),
    };
  }

  return { success: true, data: data as T };
}

/**
 * Enhanced wrapper for database operations with comprehensive validation
 */
export async function withEnhancedValidation<TInput, TOutput>(
  data: unknown,
  schema: z.ZodSchema<TInput>,
  operation: (validatedData: TInput) => Promise<Result<TOutput>>,
  context?: Record<string, unknown>,
): Promise<Result<TOutput>> {
  const validation = validateWithSchema(schema, data, context);

  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  try {
    return await operation(validation.data);
  } catch (error) {
    return {
      success: false,
      error: DatabaseError.fromUnknown(error, {
        validatedInput: validation.data,
        ...context,
      }),
    };
  }
}
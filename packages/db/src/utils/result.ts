// =============================================================================
// RESULT TYPE AND ERROR HANDLING UTILITIES
// =============================================================================

/**
 * Result type for consistent error handling across database operations
 */
export type Result<T, E = DatabaseError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Standardized database error types
 */
export enum DatabaseErrorType {
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CONSTRAINT_VIOLATION = "CONSTRAINT_VIOLATION",
  TRANSACTION_ERROR = "TRANSACTION_ERROR",
  CONNECTION_ERROR = "CONNECTION_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Database error class with structured information
 */
export class DatabaseError extends Error {
  constructor(
    public readonly type: DatabaseErrorType,
    message: string,
    public readonly originalError?: unknown,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DatabaseError";
  }

  /**
   * Create a DatabaseError from an unknown error
   */
  static fromUnknown(
    error: unknown,
    context?: Record<string, unknown>,
  ): DatabaseError {
    if (error instanceof DatabaseError) {
      return error;
    }

    if (error instanceof Error) {
      // Parse common database errors
      if (
        error.message.includes("not found") ||
        error.message.includes("NOT_FOUND")
      ) {
        return new DatabaseError(
          DatabaseErrorType.NOT_FOUND,
          error.message,
          error,
          context,
        );
      }

      if (
        error.message.includes("constraint") ||
        error.message.includes("CONSTRAINT")
      ) {
        return new DatabaseError(
          DatabaseErrorType.CONSTRAINT_VIOLATION,
          error.message,
          error,
          context,
        );
      }

      if (
        error.message.includes("transaction") ||
        error.message.includes("TRANSACTION")
      ) {
        return new DatabaseError(
          DatabaseErrorType.TRANSACTION_ERROR,
          error.message,
          error,
          context,
        );
      }

      return new DatabaseError(
        DatabaseErrorType.UNKNOWN_ERROR,
        error.message,
        error,
        context,
      );
    }

    return new DatabaseError(
      DatabaseErrorType.UNKNOWN_ERROR,
      "Unknown error occurred",
      error,
      context,
    );
  }
}

/**
 * Success result factory
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Error result factory
 */
export function failure<T>(error: DatabaseError): Result<T> {
  return { success: false, error };
}

/**
 * Async operation wrapper that converts exceptions to Result type
 */
export async function tryAsync<T>(
  operation: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<Result<T>> {
  try {
    const data = await operation();
    return success(data);
  } catch (error) {
    return failure(DatabaseError.fromUnknown(error, context));
  }
}

/**
 * Sync operation wrapper that converts exceptions to Result type
 */
export function trySync<T>(
  operation: () => T,
  context?: Record<string, unknown>,
): Result<T> {
  try {
    const data = operation();
    return success(data);
  } catch (error) {
    return failure(DatabaseError.fromUnknown(error, context));
  }
}

/**
 * Check if array result has data and return first item safely
 */
export function getFirstResult<T>(
  results: T[],
  errorMessage: string = "No results found",
): Result<T> {
  if (results.length === 0) {
    return failure(
      new DatabaseError(DatabaseErrorType.NOT_FOUND, errorMessage),
    );
  }
  const firstItem = results[0];
  if (firstItem === undefined) {
    return failure(
      new DatabaseError(DatabaseErrorType.NOT_FOUND, "First item is undefined"),
    );
  }
  return success(firstItem);
}

/**
 * Check if array result has data, return first item or null safely
 */
export function getFirstOrNull<T>(results: T[]): T | null {
  if (results.length === 0) {
    return null;
  }
  const firstItem = results[0];
  return firstItem === undefined ? null : firstItem;
}

/**
 * Validate that required fields are present
 */
export function validateRequired<T extends Record<string, unknown>>(
  data: T,
  requiredFields: (keyof T)[],
): Result<T> {
  const missingFields = requiredFields.filter(
    (field) => data[field] === undefined || data[field] === null,
  );

  if (missingFields.length > 0) {
    return failure(
      new DatabaseError(
        DatabaseErrorType.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(", ")}`,
        undefined,
        { missingFields, providedData: data },
      ),
    );
  }

  return success(data);
}

/**
 * Transform Result<T> to Result<U>
 */
export function mapResult<T, U>(
  result: Result<T>,
  transform: (data: T) => U,
): Result<U> {
  if (result.success) {
    return success(transform(result.data));
  }
  return result;
}

/**
 * Chain Result operations (flatMap/bind equivalent)
 */
export function chainResult<T, U>(
  result: Result<T>,
  operation: (data: T) => Result<U>,
): Result<U> {
  if (result.success) {
    return operation(result.data);
  }
  return result;
}

/**
 * Combine multiple Results - all must succeed
 */
export function combineResults<T extends readonly unknown[]>(
  ...results: { [K in keyof T]: Result<T[K]> }
): Result<T> {
  for (const result of results) {
    if (!result.success) {
      return result as Result<T>;
    }
  }

  const data = results.map((r) => (r.success ? r.data : undefined)) as unknown;
  return success(data as T);
}

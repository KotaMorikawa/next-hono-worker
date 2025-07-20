// Re-export all schemas and types

export * from "./api";
export * from "./auth";
export * from "./x402";

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

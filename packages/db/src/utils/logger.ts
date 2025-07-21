// =============================================================================
// 統一ログシステム - 構造化ログとコンテキスト管理
// =============================================================================

/**
 * ログレベル定義
 */
export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

/**
 * ログエントリの構造定義
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  operation?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  };
}

/**
 * ログ出力先インターフェース
 */
export interface LogOutput {
  write(entry: LogEntry): void | Promise<void>;
}

/**
 * コンソール出力実装
 */
class ConsoleLogOutput implements LogOutput {
  write(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const operation = entry.operation ? `[${entry.operation}]` : "";
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";

    const logMessage = `${timestamp} ${entry.level.toUpperCase()} ${operation} ${entry.message}${contextStr}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(logMessage, entry.error);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
    }
  }
}

/**
 * 統一ログ機能クラス
 */
class DatabaseLogger {
  private outputs: LogOutput[] = [];

  constructor() {
    // デフォルトでコンソール出力を追加
    this.outputs.push(new ConsoleLogOutput());
  }

  /**
   * カスタムログ出力先を追加
   */
  addOutput(output: LogOutput): void {
    this.outputs.push(output);
  }

  /**
   * ログエントリを出力
   */
  private async writeLog(entry: LogEntry): Promise<void> {
    for (const output of this.outputs) {
      await output.write(entry);
    }
  }

  /**
   * エラーログ
   */
  async error(
    message: string,
    error?: unknown,
    operation?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const entry: LogEntry = {
      level: LogLevel.ERROR,
      message,
      timestamp: new Date(),
      ...(operation && { operation }),
      ...(context && { context }),
    };

    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          ...(error.stack && { stack: error.stack }),
        };
        if (error.cause !== undefined) {
          entry.error.cause = error.cause;
        }
      } else {
        entry.error = {
          name: "UnknownError",
          message: String(error),
          cause: error,
        };
      }
    }

    await this.writeLog(entry);
  }

  /**
   * 警告ログ
   */
  async warn(
    message: string,
    operation?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const entry: LogEntry = {
      level: LogLevel.WARN,
      message,
      timestamp: new Date(),
      ...(operation && { operation }),
      ...(context && { context }),
    };

    await this.writeLog(entry);
  }

  /**
   * 情報ログ
   */
  async info(
    message: string,
    operation?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const entry: LogEntry = {
      level: LogLevel.INFO,
      message,
      timestamp: new Date(),
      ...(operation && { operation }),
      ...(context && { context }),
    };

    await this.writeLog(entry);
  }

  /**
   * デバッグログ
   */
  async debug(
    message: string,
    operation?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const entry: LogEntry = {
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date(),
      ...(operation && { operation }),
      ...(context && { context }),
    };

    await this.writeLog(entry);
  }
}

/**
 * グローバルログインスタンス
 */
export const dbLogger = new DatabaseLogger();

/**
 * 便利な関数エクスポート
 */
export const logError = dbLogger.error.bind(dbLogger);
export const logWarn = dbLogger.warn.bind(dbLogger);
export const logInfo = dbLogger.info.bind(dbLogger);
export const logDebug = dbLogger.debug.bind(dbLogger);

/**
 * 非同期操作のエラーログヘルパー
 */
export async function logAsyncError<T>(
  operation: string,
  asyncFn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T | null> {
  try {
    return await asyncFn();
  } catch (error) {
    await logError(`${operation} failed`, error, operation, context);
    return null;
  }
}

/**
 * 処理時間ログヘルパー
 */
export async function logPerformance<T>(
  operation: string,
  asyncFn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await asyncFn();
    const duration = Date.now() - startTime;
    await logInfo(`${operation} completed`, operation, {
      ...context,
      duration_ms: duration,
    });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    await logError(`${operation} failed`, error, operation, {
      ...context,
      duration_ms: duration,
    });
    throw error;
  }
}

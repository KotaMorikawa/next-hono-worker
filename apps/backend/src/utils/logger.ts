import type { LogEntry, LogLevel } from "../types/monitoring";

export class Logger {
  private static instance: Logger | null = null;
  private logLevel: LogLevel;
  private kvNamespace?: KVNamespace;

  private constructor(logLevel: LogLevel = "info", kvNamespace?: KVNamespace) {
    this.logLevel = logLevel;
    this.kvNamespace = kvNamespace;
  }

  public static getInstance(
    logLevel?: LogLevel,
    kvNamespace?: KVNamespace,
  ): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(logLevel, kvNamespace);
    }
    return Logger.instance;
  }

  public static initialize(
    logLevel: LogLevel = "info",
    kvNamespace?: KVNamespace,
  ): Logger {
    Logger.instance = new Logger(logLevel, kvNamespace);
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private async persistLog(entry: LogEntry): Promise<void> {
    if (!this.kvNamespace) return;

    try {
      const key = `logs:${entry.timestamp}:${entry.requestId}`;
      await this.kvNamespace.put(key, JSON.stringify(entry), {
        expirationTtl: 86400 * 7, // 7日間保持
      });
    } catch (error) {
      // ログ永続化エラーはコンソールに出力のみ
      console.error("Failed to persist log:", error);
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Partial<LogEntry>,
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: metadata?.requestId || crypto.randomUUID(),
      userId: metadata?.userId,
      endpoint: metadata?.endpoint,
      method: metadata?.method,
      statusCode: metadata?.statusCode,
      responseTime: metadata?.responseTime,
      metadata: metadata?.metadata,
    };
  }

  private outputToConsole(entry: LogEntry): void {
    const formatted = `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.requestId}] ${entry.message}`;

    switch (entry.level) {
      case "debug":
        console.debug(formatted, entry.metadata);
        break;
      case "info":
        console.info(formatted, entry.metadata);
        break;
      case "warn":
        console.warn(formatted, entry.metadata);
        break;
      case "error":
        console.error(formatted, entry.metadata);
        break;
    }
  }

  public async log(
    level: LogLevel,
    message: string,
    metadata?: Partial<LogEntry>,
  ): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, metadata);

    // コンソール出力
    this.outputToConsole(entry);

    // KVへの永続化（非同期・ベストエフォート）
    this.persistLog(entry).catch((error) => {
      console.error("Log persistence failed:", error);
    });
  }

  public async debug(
    message: string,
    metadata?: Partial<LogEntry>,
  ): Promise<void> {
    await this.log("debug", message, metadata);
  }

  public async info(
    message: string,
    metadata?: Partial<LogEntry>,
  ): Promise<void> {
    await this.log("info", message, metadata);
  }

  public async warn(
    message: string,
    metadata?: Partial<LogEntry>,
  ): Promise<void> {
    await this.log("warn", message, metadata);
  }

  public async error(
    message: string,
    metadata?: Partial<LogEntry>,
  ): Promise<void> {
    await this.log("error", message, metadata);
  }

  public async queryLogs(
    requestId?: string,
    startTime?: string,
    endTime?: string,
    level?: LogLevel,
  ): Promise<LogEntry[]> {
    if (!this.kvNamespace) return [];

    try {
      const prefix = this.buildLogPrefix(requestId, startTime);
      const result = await this.kvNamespace.list({ prefix, limit: 1000 });

      const logs = await this.processLogEntries(result.keys, level, endTime);
      return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      console.error("Failed to query logs:", error);
      return [];
    }
  }

  private buildLogPrefix(requestId?: string, startTime?: string): string {
    return requestId
      ? `logs:${startTime || ""}:${requestId}`
      : `logs:${startTime || ""}`;
  }

  private async processLogEntries(
    keys: Array<{ name: string }>,
    level?: LogLevel,
    endTime?: string,
  ): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];

    for (const key of keys) {
      const entry = await this.parseLogEntry(key.name);
      if (entry && this.shouldIncludeEntry(entry, level, endTime)) {
        logs.push(entry);
      }
    }

    return logs;
  }

  private async parseLogEntry(keyName: string): Promise<LogEntry | null> {
    if (!this.kvNamespace) return null;

    const logData = await this.kvNamespace.get(keyName);
    return logData ? JSON.parse(logData) : null;
  }

  private shouldIncludeEntry(
    entry: LogEntry,
    level?: LogLevel,
    endTime?: string,
  ): boolean {
    if (level && entry.level !== level) return false;
    if (endTime && entry.timestamp > endTime) return false;
    return true;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

// Utility functions for easy access
export const logger = Logger.getInstance();

export const createRequestLogger = (requestId: string, userId?: string) => ({
  debug: (message: string, metadata?: Record<string, unknown>) =>
    logger.debug(message, { requestId, userId, metadata }),
  info: (message: string, metadata?: Record<string, unknown>) =>
    logger.info(message, { requestId, userId, metadata }),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    logger.warn(message, { requestId, userId, metadata }),
  error: (message: string, metadata?: Record<string, unknown>) =>
    logger.error(message, { requestId, userId, metadata }),
});

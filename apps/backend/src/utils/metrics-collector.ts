import type { ApiMetrics } from "../types/monitoring";
import { logger } from "./logger";

export interface MetricsSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    count: number;
    avgResponseTime: number;
  }>;
  statusCodeDistribution: Record<string, number>;
  timeRange: {
    from: string;
    to: string;
  };
}

export class MetricsCollector {
  private static instance: MetricsCollector | null = null;
  private kvNamespace?: KVNamespace;
  private metricsBuffer: ApiMetrics[] = [];
  private bufferSize: number = 100;
  private flushInterval: number = 60000; // 1分
  private flushTimer?: ReturnType<typeof setTimeout>;

  private constructor(kvNamespace?: KVNamespace) {
    this.kvNamespace = kvNamespace;
    this.startAutoFlush();
  }

  public static getInstance(kvNamespace?: KVNamespace): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector(kvNamespace);
    }
    return MetricsCollector.instance;
  }

  public static initialize(kvNamespace?: KVNamespace): MetricsCollector {
    MetricsCollector.instance = new MetricsCollector(kvNamespace);
    return MetricsCollector.instance;
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics().catch((error) => {
        logger.error("Failed to flush metrics", { metadata: { error } });
      });
    }, this.flushInterval);
  }

  public async recordMetric(metric: ApiMetrics): Promise<void> {
    // バッファに追加
    this.metricsBuffer.push(metric);

    // バッファサイズに達したら即座にフラッシュ
    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flushMetrics();
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0 || !this.kvNamespace) {
      return;
    }

    try {
      const metricsToFlush = [...this.metricsBuffer];
      this.metricsBuffer = [];

      // バッチ処理でKVに保存
      const promises = metricsToFlush.map(async (metric) => {
        const key = this.generateMetricKey(metric);
        await this.kvNamespace?.put(key, JSON.stringify(metric), {
          expirationTtl: 86400 * 30, // 30日間保持
        });
      });

      await Promise.all(promises);

      await logger.debug(`Flushed ${metricsToFlush.length} metrics to KV`);
    } catch (error) {
      await logger.error("Failed to flush metrics", { metadata: { error } });

      // エラーの場合、メトリクスを再度バッファに戻す
      this.metricsBuffer.unshift(...this.metricsBuffer);
    }
  }

  private generateMetricKey(metric: ApiMetrics): string {
    const date = new Date(metric.timestamp).toISOString().split("T")[0];
    const hour = new Date(metric.timestamp)
      .getHours()
      .toString()
      .padStart(2, "0");
    const minute = Math.floor(new Date(metric.timestamp).getMinutes() / 5) * 5;
    const timeSlot = `${hour}${minute.toString().padStart(2, "0")}`;

    // メトリクスキー: metrics:YYYY-MM-DD:HHMM:endpoint:method:uuid
    return `metrics:${date}:${timeSlot}:${encodeURIComponent(metric.endpoint)}:${metric.method}:${crypto.randomUUID()}`;
  }

  public async getMetricsSummary(
    startDate?: string,
    endDate?: string,
  ): Promise<MetricsSummary | null> {
    if (!this.kvNamespace) {
      await logger.warn("KV namespace not available for metrics query");
      return null;
    }

    try {
      // 現在のバッファを先にフラッシュ
      await this.flushMetrics();

      const start =
        startDate ||
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const end = endDate || new Date().toISOString().split("T")[0];

      const prefix = `metrics:${start}`;
      const result = await this.kvNamespace.list({ prefix, limit: 10000 });

      const metrics: ApiMetrics[] = [];
      for (const key of result.keys) {
        const metricData = await this.kvNamespace.get(key.name);
        if (metricData) {
          const metric: ApiMetrics = JSON.parse(metricData);

          // 日付フィルタリング
          const metricDate = metric.timestamp.split("T")[0];
          if (metricDate >= start && metricDate <= end) {
            metrics.push(metric);
          }
        }
      }

      return this.calculateSummary(metrics, start, end);
    } catch (error) {
      await logger.error("Failed to get metrics summary", {
        metadata: { error },
      });
      return null;
    }
  }

  private calculateSummary(
    metrics: ApiMetrics[],
    from: string,
    to: string,
  ): MetricsSummary {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        topEndpoints: [],
        statusCodeDistribution: {},
        timeRange: { from, to },
      };
    }

    const totalRequests = metrics.length;
    const successfulRequests = metrics.filter((m) => m.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const averageResponseTime =
      metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const errorRate = failedRequests / totalRequests;

    // エンドポイント別集計
    const endpointStats = new Map<
      string,
      { count: number; totalResponseTime: number }
    >();
    metrics.forEach((metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      const current = endpointStats.get(key) || {
        count: 0,
        totalResponseTime: 0,
      };
      endpointStats.set(key, {
        count: current.count + 1,
        totalResponseTime: current.totalResponseTime + metric.responseTime,
      });
    });

    const topEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgResponseTime: stats.totalResponseTime / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ステータスコード分布
    const statusCodeDistribution = metrics.reduce(
      (acc, metric) => {
        const statusGroup = `${Math.floor(metric.statusCode / 100)}xx`;
        acc[statusGroup] = (acc[statusGroup] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      topEndpoints,
      statusCodeDistribution,
      timeRange: { from, to },
    };
  }

  public async getEndpointMetrics(
    endpoint: string,
    method?: string,
  ): Promise<ApiMetrics[]> {
    if (!this.kvNamespace) return [];

    try {
      // 最近7日間のデータを取得
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const prefix = `metrics:${sevenDaysAgo}`;

      const result = await this.kvNamespace.list({ prefix, limit: 10000 });
      const metrics: ApiMetrics[] = [];

      for (const key of result.keys) {
        if (key.name.includes(encodeURIComponent(endpoint))) {
          const metricData = await this.kvNamespace.get(key.name);
          if (metricData) {
            const metric: ApiMetrics = JSON.parse(metricData);
            if (!method || metric.method === method) {
              metrics.push(metric);
            }
          }
        }
      }

      return metrics.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    } catch (error) {
      await logger.error("Failed to get endpoint metrics", {
        metadata: { endpoint, method, error },
      });
      return [];
    }
  }

  public async cleanup(): Promise<void> {
    // タイマーをクリア
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // 残りのメトリクスをフラッシュ
    await this.flushMetrics();
  }
}

// シングルトンインスタンスのエクスポート
export const metricsCollector = MetricsCollector.getInstance();

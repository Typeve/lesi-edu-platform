export interface SlowQueryRecord {
  queryName: string;
  durationMs: number;
  thresholdMs: number;
  observedAt: string;
}

export interface DashboardSlowQueryMetrics {
  totalQueries: number;
  slowQueries: number;
  slowQueryRate: number;
}

export interface DashboardSlowQueryObserver {
  observe(input: { queryName: string; durationMs: number }): void;
  getMetrics(): DashboardSlowQueryMetrics;
  getRecentSlowQueries(limit?: number): SlowQueryRecord[];
}

export interface CreateDashboardSlowQueryObserverInput {
  slowQueryThresholdMs: number;
  logger?: Pick<Console, "warn">;
  nowProvider?: () => Date;
  maxRecentSlowQueries?: number;
}

export const createDashboardSlowQueryObserver = ({
  slowQueryThresholdMs,
  logger = console,
  nowProvider = () => new Date(),
  maxRecentSlowQueries = 100
}: CreateDashboardSlowQueryObserverInput): DashboardSlowQueryObserver => {
  let totalQueries = 0;
  let slowQueries = 0;
  const recentSlowQueries: SlowQueryRecord[] = [];

  return {
    observe({ queryName, durationMs }: { queryName: string; durationMs: number }): void {
      totalQueries += 1;

      if (durationMs < slowQueryThresholdMs) {
        return;
      }

      slowQueries += 1;
      const record: SlowQueryRecord = {
        queryName,
        durationMs,
        thresholdMs: slowQueryThresholdMs,
        observedAt: nowProvider().toISOString()
      };

      recentSlowQueries.push(record);
      if (recentSlowQueries.length > maxRecentSlowQueries) {
        recentSlowQueries.shift();
      }

      logger.warn(
        `[metrics] slow query detected: query=${queryName} durationMs=${durationMs} thresholdMs=${slowQueryThresholdMs}`
      );
    },
    getMetrics(): DashboardSlowQueryMetrics {
      return {
        totalQueries,
        slowQueries,
        slowQueryRate: totalQueries > 0 ? slowQueries / totalQueries : 0
      };
    },
    getRecentSlowQueries(limit = maxRecentSlowQueries): SlowQueryRecord[] {
      if (limit <= 0) {
        return [];
      }

      return recentSlowQueries.slice(-limit);
    }
  };
};

export interface MeasureObservedAsyncInput<T> {
  queryName: string;
  observer: DashboardSlowQueryObserver;
  nowProvider?: () => number;
  run: () => Promise<T>;
}

export const measureObservedAsync = async <T>({
  queryName,
  observer,
  nowProvider = () => Date.now(),
  run
}: MeasureObservedAsyncInput<T>): Promise<T> => {
  const start = nowProvider();

  try {
    return await run();
  } finally {
    const end = nowProvider();
    observer.observe({
      queryName,
      durationMs: Math.max(0, end - start)
    });
  }
};

import test from "node:test";
import assert from "node:assert/strict";
import {
  createInMemoryDashboardCacheStore,
  createCachedDashboardDimensionAggregationService,
  createCachedDashboardTrendFunnelService
} from "../../src/modules/metrics/cache.ts";

test("dashboard cache should hit cache for same dimension query when strategy is ttl", async () => {
  const now = { value: 0 };
  const cacheStore = createInMemoryDashboardCacheStore({
    nowProvider: () => now.value
  });

  let calls = 0;
  const baseService = {
    async aggregateByDimension() {
      calls += 1;
      return {
        dictionaryVersion: "b07.v1",
        dimension: "college" as const,
        metricCards: {
          activatedStudentsCount: 1,
          assessmentCompletionRate: 1,
          reportGenerationRate: 1,
          taskCompletionRate: 1,
          activityParticipationRate: 1
        },
        barChart: {
          dimension: "college" as const,
          categories: [],
          series: []
        },
        stackedBarChart: {
          dimension: "college" as const,
          categories: [],
          series: []
        }
      };
    }
  };

  const service = createCachedDashboardDimensionAggregationService({
    dashboardDimensionAggregationService: baseService,
    cacheStore,
    cacheConfig: {
      ttlMs: 60_000,
      invalidationStrategy: "ttl"
    }
  });

  const input = {
    dimension: "college" as const,
    filters: {
      schoolId: 1
    }
  };

  await service.aggregateByDimension(input);
  await service.aggregateByDimension(input);

  assert.equal(calls, 1);
});

test("dashboard cache should expire by ttl", async () => {
  const now = { value: 0 };
  const cacheStore = createInMemoryDashboardCacheStore({
    nowProvider: () => now.value
  });

  let calls = 0;
  const baseService = {
    async aggregateByDimension() {
      calls += 1;
      return {
        dictionaryVersion: "b07.v1",
        dimension: "major" as const,
        metricCards: {
          activatedStudentsCount: calls,
          assessmentCompletionRate: 1,
          reportGenerationRate: 1,
          taskCompletionRate: 1,
          activityParticipationRate: 1
        },
        barChart: {
          dimension: "major" as const,
          categories: [],
          series: []
        },
        stackedBarChart: {
          dimension: "major" as const,
          categories: [],
          series: []
        }
      };
    }
  };

  const service = createCachedDashboardDimensionAggregationService({
    dashboardDimensionAggregationService: baseService,
    cacheStore,
    cacheConfig: {
      ttlMs: 1000,
      invalidationStrategy: "ttl"
    }
  });

  const input = {
    dimension: "major" as const,
    filters: {}
  };

  const first = await service.aggregateByDimension(input);
  now.value = 500;
  const second = await service.aggregateByDimension(input);
  now.value = 2000;
  const third = await service.aggregateByDimension(input);

  assert.equal(first.metricCards.activatedStudentsCount, 1);
  assert.equal(second.metricCards.activatedStudentsCount, 1);
  assert.equal(third.metricCards.activatedStudentsCount, 2);
  assert.equal(calls, 2);
});

test("dashboard cache should be bypassed when strategy is disabled", async () => {
  const cacheStore = createInMemoryDashboardCacheStore();

  let calls = 0;
  const baseService = {
    async getTrendAndFunnel() {
      calls += 1;
      return {
        dictionaryVersion: "b07.v1",
        dateRange: {
          startDate: "2026-02-01",
          endDate: "2026-03-01"
        },
        trend: [],
        funnel: []
      };
    }
  };

  const service = createCachedDashboardTrendFunnelService({
    dashboardTrendFunnelService: baseService,
    cacheStore,
    cacheConfig: {
      ttlMs: 60_000,
      invalidationStrategy: "disabled"
    }
  });

  const input = {
    filters: {
      schoolId: 1
    },
    startDate: "2026-02-01",
    endDate: "2026-03-01"
  };

  await service.getTrendAndFunnel(input);
  await service.getTrendAndFunnel(input);

  assert.equal(calls, 2);
});

test("dashboard cache hit should respond under 1 second after warmup", async () => {
  const cacheStore = createInMemoryDashboardCacheStore();

  let calls = 0;
  const baseService = {
    async aggregateByDimension() {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return {
        dictionaryVersion: "b07.v1",
        dimension: "class" as const,
        metricCards: {
          activatedStudentsCount: 10000,
          assessmentCompletionRate: 0.8,
          reportGenerationRate: 0.7,
          taskCompletionRate: 0.6,
          activityParticipationRate: 0.5
        },
        barChart: {
          dimension: "class" as const,
          categories: [],
          series: []
        },
        stackedBarChart: {
          dimension: "class" as const,
          categories: [],
          series: []
        }
      };
    }
  };

  const service = createCachedDashboardDimensionAggregationService({
    dashboardDimensionAggregationService: baseService,
    cacheStore,
    cacheConfig: {
      ttlMs: 60_000,
      invalidationStrategy: "ttl"
    }
  });

  const input = {
    dimension: "class" as const,
    filters: {
      schoolId: 1
    }
  };

  await service.aggregateByDimension(input);

  const start = Date.now();
  await service.aggregateByDimension(input);
  const durationMs = Date.now() - start;

  assert.equal(calls, 1);
  assert.ok(
    durationMs < 1000,
    `cache hit duration should be below 1000ms, actual=${durationMs}ms`
  );
});

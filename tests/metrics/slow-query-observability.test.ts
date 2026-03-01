import test from "node:test";
import assert from "node:assert/strict";
import {
  createDashboardSlowQueryObserver,
  measureObservedAsync
} from "../../src/modules/metrics/observability.ts";

test("slow query observer should record slow query and expose metrics", async () => {
  const warnings: string[] = [];
  const nowMs = { value: 0 };

  const observer = createDashboardSlowQueryObserver({
    slowQueryThresholdMs: 100,
    logger: {
      warn(message: string) {
        warnings.push(message);
      }
    }
  });

  await measureObservedAsync({
    queryName: "metrics.listClassMetricRecords",
    observer,
    nowProvider: () => nowMs.value,
    run: async () => {
      nowMs.value = 120;
      return 1;
    }
  });

  const metrics = observer.getMetrics();
  assert.equal(metrics.totalQueries, 1);
  assert.equal(metrics.slowQueries, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /slow query detected/);

  const recent = observer.getRecentSlowQueries();
  assert.equal(recent.length, 1);
  assert.equal(recent[0].queryName, "metrics.listClassMetricRecords");
  assert.equal(recent[0].durationMs, 120);
});

test("slow query observer should observe duration even when execution throws", async () => {
  const nowMs = { value: 0 };

  const observer = createDashboardSlowQueryObserver({
    slowQueryThresholdMs: 100
  });

  await assert.rejects(async () => {
    await measureObservedAsync({
      queryName: "metrics.listActivatedStudents",
      observer,
      nowProvider: () => nowMs.value,
      run: async () => {
        nowMs.value = 150;
        throw new Error("query failed");
      }
    });
  }, /query failed/);

  const metrics = observer.getMetrics();
  assert.equal(metrics.totalQueries, 1);
  assert.equal(metrics.slowQueries, 1);
});

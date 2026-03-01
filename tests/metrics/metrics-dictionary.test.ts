import test from "node:test";
import assert from "node:assert/strict";
import {
  CONVERSION_FUNNEL_STAGES,
  METRICS_DICTIONARY_CHANGELOG,
  METRICS_DICTIONARY_VERSION,
  METRIC_DEFINITIONS
} from "../../src/modules/metrics/dictionary.ts";

test("metrics dictionary should define four key dashboard metrics", () => {
  assert.equal(METRIC_DEFINITIONS.assessmentCompletionRate.code, "assessment_completion_rate");
  assert.equal(METRIC_DEFINITIONS.reportGenerationRate.code, "report_generation_rate");
  assert.equal(METRIC_DEFINITIONS.taskCompletionRate.code, "task_completion_rate");
  assert.equal(METRIC_DEFINITIONS.activityParticipationRate.code, "activity_participation_rate");

  assert.equal(
    METRIC_DEFINITIONS.taskCompletionRate.denominator,
    "students_with_assigned_tasks_count"
  );
  assert.equal(
    METRIC_DEFINITIONS.taskCompletionRate.numerator,
    "students_with_completed_task_count"
  );
});

test("metrics dictionary should keep fixed funnel stage order", () => {
  assert.deepEqual(
    CONVERSION_FUNNEL_STAGES.map((stage) => stage.code),
    [
      "activated_students",
      "assessment_completed_students",
      "report_generated_students",
      "task_completed_students",
      "activity_participated_students"
    ]
  );
});

test("metrics dictionary should be version traceable", () => {
  assert.ok(METRICS_DICTIONARY_VERSION.length > 0);
  assert.ok(METRICS_DICTIONARY_CHANGELOG.length > 0);

  const currentVersion = METRICS_DICTIONARY_CHANGELOG[0];
  assert.equal(currentVersion.version, METRICS_DICTIONARY_VERSION);
  assert.ok(currentVersion.summary.length > 0);
});

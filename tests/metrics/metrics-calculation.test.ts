import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateConversionFunnel,
  calculateDashboardMetricRates
} from "../../src/modules/metrics/dictionary.ts";

test("metric calculation should follow defined formulas", () => {
  const result = calculateDashboardMetricRates({
    activatedStudentsCount: 100,
    assessmentCompletedStudentsCount: 80,
    reportGeneratedStudentsCount: 60,
    studentsWithAssignedTasksCount: 40,
    studentsWithCompletedTaskCount: 10,
    studentsEligibleForActivitiesCount: 20,
    studentsParticipatedActivitiesCount: 5
  });

  assert.equal(result.assessmentCompletionRate, 0.8);
  assert.equal(result.reportGenerationRate, 0.6);
  assert.equal(result.taskCompletionRate, 0.25);
  assert.equal(result.activityParticipationRate, 0.25);
});

test("metric calculation should return 0 when denominator is 0", () => {
  const result = calculateDashboardMetricRates({
    activatedStudentsCount: 0,
    assessmentCompletedStudentsCount: 10,
    reportGeneratedStudentsCount: 20,
    studentsWithAssignedTasksCount: 0,
    studentsWithCompletedTaskCount: 3,
    studentsEligibleForActivitiesCount: 0,
    studentsParticipatedActivitiesCount: 1
  });

  assert.equal(result.assessmentCompletionRate, 0);
  assert.equal(result.reportGenerationRate, 0);
  assert.equal(result.taskCompletionRate, 0);
  assert.equal(result.activityParticipationRate, 0);
});

test("funnel calculation should keep stage order and conversion", () => {
  const funnel = calculateConversionFunnel({
    activatedStudentsCount: 100,
    assessmentCompletedStudentsCount: 70,
    reportGeneratedStudentsCount: 50,
    studentsWithCompletedTaskCount: 20,
    studentsParticipatedActivitiesCount: 10
  });

  assert.deepEqual(
    funnel.map((item) => item.stageCode),
    [
      "activated_students",
      "assessment_completed_students",
      "report_generated_students",
      "task_completed_students",
      "activity_participated_students"
    ]
  );

  assert.equal(funnel[0].conversionFromPrevious, 1);
  assert.equal(funnel[1].conversionFromPrevious, 0.7);
  assert.equal(funnel[2].conversionFromPrevious, 50 / 70);
  assert.equal(funnel[3].conversionFromPrevious, 20 / 50);
  assert.equal(funnel[4].conversionFromPrevious, 10 / 20);
});

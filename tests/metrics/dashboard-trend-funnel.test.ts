import test from "node:test";
import assert from "node:assert/strict";
import {
  createDashboardTrendFunnelService,
  type DashboardTrendFunnelRepository
} from "../../src/modules/metrics/trend-funnel.ts";

const repository: DashboardTrendFunnelRepository = {
  async listActivatedStudents() {
    return [
      { studentId: 1, date: "2026-03-01" },
      { studentId: 2, date: "2026-03-02" },
      { studentId: 3, date: "2026-03-04" }
    ];
  },
  async listAssessmentCompletedStudents() {
    return [
      { studentId: 1, date: "2026-03-02" },
      { studentId: 2, date: "2026-03-04" }
    ];
  },
  async listReportGeneratedStudents() {
    return [{ studentId: 1, date: "2026-03-03" }];
  },
  async listTaskCompletedStudents() {
    return [{ studentId: 1, date: "2026-03-04" }];
  },
  async listActivityParticipatedStudents() {
    return [{ studentId: 1, date: "2026-03-04" }];
  }
};

test("trend-funnel service should return continuous date trend and fixed-order funnel", async () => {
  const service = createDashboardTrendFunnelService({
    dashboardTrendFunnelRepo: repository,
    nowProvider: () => new Date("2026-03-04T00:00:00Z")
  });

  const result = await service.getTrendAndFunnel({
    filters: {},
    startDate: "2026-03-01",
    endDate: "2026-03-04"
  });

  assert.equal(result.dictionaryVersion, "b07.v1");
  assert.equal(result.trend.length, 4);
  assert.deepEqual(
    result.trend.map((item) => item.date),
    ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"]
  );

  const day4 = result.trend[3];
  assert.equal(day4.activatedStudentsCount, 1);
  assert.equal(day4.assessmentCompletedStudentsCount, 1);
  assert.equal(day4.reportGeneratedStudentsCount, 0);
  assert.equal(day4.taskCompletedStudentsCount, 1);
  assert.equal(day4.activityParticipatedStudentsCount, 1);

  assert.deepEqual(
    result.funnel.map((stage) => stage.stageCode),
    [
      "activated_students",
      "assessment_completed_students",
      "report_generated_students",
      "task_completed_students",
      "activity_participated_students"
    ]
  );
});

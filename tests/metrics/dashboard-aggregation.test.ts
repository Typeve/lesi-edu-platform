import test from "node:test";
import assert from "node:assert/strict";
import {
  createDashboardDimensionAggregationService,
  type DashboardMetricsRepository
} from "../../src/modules/metrics/aggregation.ts";

const repository: DashboardMetricsRepository = {
  async listClassMetricRecords() {
    return [
      {
        schoolId: 1,
        collegeId: 10,
        collegeName: "信息工程学院",
        majorId: 100,
        majorName: "软件工程",
        classId: 1000,
        className: "软工1班",
        activatedStudentsCount: 40,
        assessmentCompletedStudentsCount: 20,
        reportGeneratedStudentsCount: 10,
        studentsWithAssignedTasksCount: 10,
        studentsWithCompletedTaskCount: 5,
        studentsEligibleForActivitiesCount: 20,
        studentsParticipatedActivitiesCount: 4,
        reportDirectionEmploymentCount: 6,
        reportDirectionPostgraduateCount: 3,
        reportDirectionCivilServiceCount: 1
      },
      {
        schoolId: 1,
        collegeId: 10,
        collegeName: "信息工程学院",
        majorId: 101,
        majorName: "网络工程",
        classId: 1001,
        className: "网工1班",
        activatedStudentsCount: 30,
        assessmentCompletedStudentsCount: 15,
        reportGeneratedStudentsCount: 9,
        studentsWithAssignedTasksCount: 12,
        studentsWithCompletedTaskCount: 6,
        studentsEligibleForActivitiesCount: 15,
        studentsParticipatedActivitiesCount: 5,
        reportDirectionEmploymentCount: 4,
        reportDirectionPostgraduateCount: 2,
        reportDirectionCivilServiceCount: 3
      },
      {
        schoolId: 1,
        collegeId: 11,
        collegeName: "经济管理学院",
        majorId: 110,
        majorName: "工商管理",
        classId: 1101,
        className: "工商1班",
        activatedStudentsCount: 20,
        assessmentCompletedStudentsCount: 10,
        reportGeneratedStudentsCount: 8,
        studentsWithAssignedTasksCount: 8,
        studentsWithCompletedTaskCount: 4,
        studentsEligibleForActivitiesCount: 10,
        studentsParticipatedActivitiesCount: 3,
        reportDirectionEmploymentCount: 4,
        reportDirectionPostgraduateCount: 2,
        reportDirectionCivilServiceCount: 2
      }
    ];
  }
};

test("dashboard aggregation should return metric cards and chart data by dimension", async () => {
  const service = createDashboardDimensionAggregationService({
    dashboardMetricsRepo: repository
  });

  const result = await service.aggregateByDimension({
    dimension: "college",
    filters: {
      schoolId: 1
    }
  });

  assert.equal(result.metricCards.activatedStudentsCount, 90);
  assert.equal(result.barChart.dimension, "college");
  assert.deepEqual(result.barChart.categories, ["信息工程学院", "经济管理学院"]);

  const stackedSeries = result.stackedBarChart.series;
  assert.equal(stackedSeries.length, 3);
  assert.equal(stackedSeries[0].direction, "employment");
  assert.deepEqual(stackedSeries[0].values, [10, 4]);
});


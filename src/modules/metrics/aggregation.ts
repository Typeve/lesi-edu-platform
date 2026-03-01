import {
  METRICS_DICTIONARY_VERSION,
  calculateDashboardMetricRates,
  type DashboardMetricRateResult
} from "./dictionary.js";

export type DashboardDimension = "college" | "major" | "class";

export interface DashboardFilters {
  schoolId?: number;
  collegeId?: number;
  majorId?: number;
  classId?: number;
}

export interface ClassMetricRecord {
  schoolId: number;
  collegeId: number;
  collegeName: string;
  majorId: number | null;
  majorName: string | null;
  classId: number;
  className: string;
  activatedStudentsCount: number;
  assessmentCompletedStudentsCount: number;
  reportGeneratedStudentsCount: number;
  studentsWithAssignedTasksCount: number;
  studentsWithCompletedTaskCount: number;
  studentsEligibleForActivitiesCount: number;
  studentsParticipatedActivitiesCount: number;
  reportDirectionEmploymentCount: number;
  reportDirectionPostgraduateCount: number;
  reportDirectionCivilServiceCount: number;
}

export interface DashboardMetricsRepository {
  listClassMetricRecords(filters: DashboardFilters): Promise<ClassMetricRecord[]>;
}

export interface AggregateByDimensionInput {
  dimension: DashboardDimension;
  filters: DashboardFilters;
}

export interface DimensionMetricCards extends DashboardMetricRateResult {
  activatedStudentsCount: number;
}

export interface DashboardBarSeries {
  code:
    | "assessment_completion_rate"
    | "report_generation_rate"
    | "task_completion_rate"
    | "activity_participation_rate";
  name: string;
  values: number[];
}

export interface DashboardBarChart {
  dimension: DashboardDimension;
  categories: string[];
  series: DashboardBarSeries[];
}

export interface DashboardStackedSeries {
  direction: "employment" | "postgraduate" | "civil_service";
  values: number[];
}

export interface DashboardStackedBarChart {
  dimension: DashboardDimension;
  categories: string[];
  series: DashboardStackedSeries[];
}

export interface DashboardDimensionAggregationResult {
  dictionaryVersion: string;
  dimension: DashboardDimension;
  metricCards: DimensionMetricCards;
  barChart: DashboardBarChart;
  stackedBarChart: DashboardStackedBarChart;
}

export interface DashboardDimensionAggregationService {
  aggregateByDimension(input: AggregateByDimensionInput): Promise<DashboardDimensionAggregationResult>;
}

export interface CreateDashboardDimensionAggregationServiceInput {
  dashboardMetricsRepo: DashboardMetricsRepository;
}

interface GroupedMetricRecord {
  id: number;
  name: string;
  activatedStudentsCount: number;
  assessmentCompletedStudentsCount: number;
  reportGeneratedStudentsCount: number;
  studentsWithAssignedTasksCount: number;
  studentsWithCompletedTaskCount: number;
  studentsEligibleForActivitiesCount: number;
  studentsParticipatedActivitiesCount: number;
  reportDirectionEmploymentCount: number;
  reportDirectionPostgraduateCount: number;
  reportDirectionCivilServiceCount: number;
}

const emptyGroup = (id: number, name: string): GroupedMetricRecord => ({
  id,
  name,
  activatedStudentsCount: 0,
  assessmentCompletedStudentsCount: 0,
  reportGeneratedStudentsCount: 0,
  studentsWithAssignedTasksCount: 0,
  studentsWithCompletedTaskCount: 0,
  studentsEligibleForActivitiesCount: 0,
  studentsParticipatedActivitiesCount: 0,
  reportDirectionEmploymentCount: 0,
  reportDirectionPostgraduateCount: 0,
  reportDirectionCivilServiceCount: 0
});

const mergeRecord = (group: GroupedMetricRecord, record: ClassMetricRecord): void => {
  group.activatedStudentsCount += record.activatedStudentsCount;
  group.assessmentCompletedStudentsCount += record.assessmentCompletedStudentsCount;
  group.reportGeneratedStudentsCount += record.reportGeneratedStudentsCount;
  group.studentsWithAssignedTasksCount += record.studentsWithAssignedTasksCount;
  group.studentsWithCompletedTaskCount += record.studentsWithCompletedTaskCount;
  group.studentsEligibleForActivitiesCount += record.studentsEligibleForActivitiesCount;
  group.studentsParticipatedActivitiesCount += record.studentsParticipatedActivitiesCount;
  group.reportDirectionEmploymentCount += record.reportDirectionEmploymentCount;
  group.reportDirectionPostgraduateCount += record.reportDirectionPostgraduateCount;
  group.reportDirectionCivilServiceCount += record.reportDirectionCivilServiceCount;
};

const groupByDimension = (
  records: ClassMetricRecord[],
  dimension: DashboardDimension
): GroupedMetricRecord[] => {
  const groups = new Map<string, GroupedMetricRecord>();

  for (const record of records) {
    let id: number;
    let name: string;

    if (dimension === "college") {
      id = record.collegeId;
      name = record.collegeName;
    } else if (dimension === "major") {
      id = record.majorId ?? 0;
      name = record.majorName ?? "未分配专业";
    } else {
      id = record.classId;
      name = record.className;
    }

    const key = `${dimension}:${id}`;
    const existing = groups.get(key) ?? emptyGroup(id, name);

    mergeRecord(existing, record);
    groups.set(key, existing);
  }

  return [...groups.values()].sort((a, b) => a.id - b.id);
};

const createMetricCards = (records: ClassMetricRecord[]): DimensionMetricCards => {
  const summary = records.reduce(
    (acc, record) => {
      acc.activatedStudentsCount += record.activatedStudentsCount;
      acc.assessmentCompletedStudentsCount += record.assessmentCompletedStudentsCount;
      acc.reportGeneratedStudentsCount += record.reportGeneratedStudentsCount;
      acc.studentsWithAssignedTasksCount += record.studentsWithAssignedTasksCount;
      acc.studentsWithCompletedTaskCount += record.studentsWithCompletedTaskCount;
      acc.studentsEligibleForActivitiesCount += record.studentsEligibleForActivitiesCount;
      acc.studentsParticipatedActivitiesCount += record.studentsParticipatedActivitiesCount;
      return acc;
    },
    {
      activatedStudentsCount: 0,
      assessmentCompletedStudentsCount: 0,
      reportGeneratedStudentsCount: 0,
      studentsWithAssignedTasksCount: 0,
      studentsWithCompletedTaskCount: 0,
      studentsEligibleForActivitiesCount: 0,
      studentsParticipatedActivitiesCount: 0
    }
  );

  const rates = calculateDashboardMetricRates(summary);

  return {
    activatedStudentsCount: summary.activatedStudentsCount,
    ...rates
  };
};

const createBarChart = (
  groups: GroupedMetricRecord[],
  dimension: DashboardDimension
): DashboardBarChart => {
  const categories = groups.map((group) => group.name);

  return {
    dimension,
    categories,
    series: [
      {
        code: "assessment_completion_rate",
        name: "测评完成率",
        values: groups.map((group) =>
          calculateDashboardMetricRates({
            activatedStudentsCount: group.activatedStudentsCount,
            assessmentCompletedStudentsCount: group.assessmentCompletedStudentsCount,
            reportGeneratedStudentsCount: group.reportGeneratedStudentsCount,
            studentsWithAssignedTasksCount: group.studentsWithAssignedTasksCount,
            studentsWithCompletedTaskCount: group.studentsWithCompletedTaskCount,
            studentsEligibleForActivitiesCount: group.studentsEligibleForActivitiesCount,
            studentsParticipatedActivitiesCount: group.studentsParticipatedActivitiesCount
          }).assessmentCompletionRate
        )
      },
      {
        code: "report_generation_rate",
        name: "报告生成率",
        values: groups.map((group) =>
          calculateDashboardMetricRates({
            activatedStudentsCount: group.activatedStudentsCount,
            assessmentCompletedStudentsCount: group.assessmentCompletedStudentsCount,
            reportGeneratedStudentsCount: group.reportGeneratedStudentsCount,
            studentsWithAssignedTasksCount: group.studentsWithAssignedTasksCount,
            studentsWithCompletedTaskCount: group.studentsWithCompletedTaskCount,
            studentsEligibleForActivitiesCount: group.studentsEligibleForActivitiesCount,
            studentsParticipatedActivitiesCount: group.studentsParticipatedActivitiesCount
          }).reportGenerationRate
        )
      },
      {
        code: "task_completion_rate",
        name: "任务完成率",
        values: groups.map((group) =>
          calculateDashboardMetricRates({
            activatedStudentsCount: group.activatedStudentsCount,
            assessmentCompletedStudentsCount: group.assessmentCompletedStudentsCount,
            reportGeneratedStudentsCount: group.reportGeneratedStudentsCount,
            studentsWithAssignedTasksCount: group.studentsWithAssignedTasksCount,
            studentsWithCompletedTaskCount: group.studentsWithCompletedTaskCount,
            studentsEligibleForActivitiesCount: group.studentsEligibleForActivitiesCount,
            studentsParticipatedActivitiesCount: group.studentsParticipatedActivitiesCount
          }).taskCompletionRate
        )
      },
      {
        code: "activity_participation_rate",
        name: "活动参与率",
        values: groups.map((group) =>
          calculateDashboardMetricRates({
            activatedStudentsCount: group.activatedStudentsCount,
            assessmentCompletedStudentsCount: group.assessmentCompletedStudentsCount,
            reportGeneratedStudentsCount: group.reportGeneratedStudentsCount,
            studentsWithAssignedTasksCount: group.studentsWithAssignedTasksCount,
            studentsWithCompletedTaskCount: group.studentsWithCompletedTaskCount,
            studentsEligibleForActivitiesCount: group.studentsEligibleForActivitiesCount,
            studentsParticipatedActivitiesCount: group.studentsParticipatedActivitiesCount
          }).activityParticipationRate
        )
      }
    ]
  };
};

const createStackedBarChart = (
  groups: GroupedMetricRecord[],
  dimension: DashboardDimension
): DashboardStackedBarChart => {
  return {
    dimension,
    categories: groups.map((group) => group.name),
    series: [
      {
        direction: "employment",
        values: groups.map((group) => group.reportDirectionEmploymentCount)
      },
      {
        direction: "postgraduate",
        values: groups.map((group) => group.reportDirectionPostgraduateCount)
      },
      {
        direction: "civil_service",
        values: groups.map((group) => group.reportDirectionCivilServiceCount)
      }
    ]
  };
};

export const createDashboardDimensionAggregationService = ({
  dashboardMetricsRepo
}: CreateDashboardDimensionAggregationServiceInput): DashboardDimensionAggregationService => {
  return {
    async aggregateByDimension({
      dimension,
      filters
    }: AggregateByDimensionInput): Promise<DashboardDimensionAggregationResult> {
      const records = await dashboardMetricsRepo.listClassMetricRecords(filters);
      const groups = groupByDimension(records, dimension);

      return {
        dictionaryVersion: METRICS_DICTIONARY_VERSION,
        dimension,
        metricCards: createMetricCards(records),
        barChart: createBarChart(groups, dimension),
        stackedBarChart: createStackedBarChart(groups, dimension)
      };
    }
  };
};

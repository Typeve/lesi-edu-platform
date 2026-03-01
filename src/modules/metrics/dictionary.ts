export const METRICS_DICTIONARY_VERSION = "b07.v1" as const;

export interface MetricsDictionaryChangelogItem {
  version: string;
  releasedAt: string;
  summary: string;
}

export const METRICS_DICTIONARY_CHANGELOG: MetricsDictionaryChangelogItem[] = [
  {
    version: METRICS_DICTIONARY_VERSION,
    releasedAt: "2026-03-01",
    summary: "首次定义驾驶舱核心指标与转化漏斗统一口径"
  }
];

export interface MetricDefinition {
  code:
    | "assessment_completion_rate"
    | "report_generation_rate"
    | "task_completion_rate"
    | "activity_participation_rate";
  name: string;
  numerator: string;
  denominator: string;
  formula: string;
  version: string;
}

export const METRIC_DEFINITIONS = {
  assessmentCompletionRate: {
    code: "assessment_completion_rate",
    name: "测评完成率",
    numerator: "assessment_completed_students_count",
    denominator: "activated_students_count",
    formula: "assessment_completed_students_count / activated_students_count",
    version: METRICS_DICTIONARY_VERSION
  },
  reportGenerationRate: {
    code: "report_generation_rate",
    name: "报告生成率",
    numerator: "report_generated_students_count",
    denominator: "activated_students_count",
    formula: "report_generated_students_count / activated_students_count",
    version: METRICS_DICTIONARY_VERSION
  },
  taskCompletionRate: {
    code: "task_completion_rate",
    name: "任务完成率",
    numerator: "students_with_completed_task_count",
    denominator: "students_with_assigned_tasks_count",
    formula: "students_with_completed_task_count / students_with_assigned_tasks_count",
    version: METRICS_DICTIONARY_VERSION
  },
  activityParticipationRate: {
    code: "activity_participation_rate",
    name: "活动参与率",
    numerator: "students_participated_activities_count",
    denominator: "students_eligible_for_activities_count",
    formula: "students_participated_activities_count / students_eligible_for_activities_count",
    version: METRICS_DICTIONARY_VERSION
  }
} as const satisfies Record<string, MetricDefinition>;

export interface FunnelStageDefinition {
  code:
    | "activated_students"
    | "assessment_completed_students"
    | "report_generated_students"
    | "task_completed_students"
    | "activity_participated_students";
  name: string;
  description: string;
  version: string;
}

export const CONVERSION_FUNNEL_STAGES: FunnelStageDefinition[] = [
  {
    code: "activated_students",
    name: "登录激活",
    description: "完成登录并激活账号的学生",
    version: METRICS_DICTIONARY_VERSION
  },
  {
    code: "assessment_completed_students",
    name: "测评完成",
    description: "完成测评提交的学生",
    version: METRICS_DICTIONARY_VERSION
  },
  {
    code: "report_generated_students",
    name: "报告生成",
    description: "成功生成任一报告的学生",
    version: METRICS_DICTIONARY_VERSION
  },
  {
    code: "task_completed_students",
    name: "任务完成",
    description: "至少完成 1 个任务的学生",
    version: METRICS_DICTIONARY_VERSION
  },
  {
    code: "activity_participated_students",
    name: "活动参与",
    description: "参与活动的学生",
    version: METRICS_DICTIONARY_VERSION
  }
];

const safeDivide = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
};

export interface DashboardMetricRateInput {
  activatedStudentsCount: number;
  assessmentCompletedStudentsCount: number;
  reportGeneratedStudentsCount: number;
  studentsWithAssignedTasksCount: number;
  studentsWithCompletedTaskCount: number;
  studentsEligibleForActivitiesCount: number;
  studentsParticipatedActivitiesCount: number;
}

export interface DashboardMetricRateResult {
  assessmentCompletionRate: number;
  reportGenerationRate: number;
  taskCompletionRate: number;
  activityParticipationRate: number;
}

export const calculateDashboardMetricRates = (
  input: DashboardMetricRateInput
): DashboardMetricRateResult => {
  return {
    assessmentCompletionRate: safeDivide(
      input.assessmentCompletedStudentsCount,
      input.activatedStudentsCount
    ),
    reportGenerationRate: safeDivide(input.reportGeneratedStudentsCount, input.activatedStudentsCount),
    taskCompletionRate: safeDivide(
      input.studentsWithCompletedTaskCount,
      input.studentsWithAssignedTasksCount
    ),
    activityParticipationRate: safeDivide(
      input.studentsParticipatedActivitiesCount,
      input.studentsEligibleForActivitiesCount
    )
  };
};

export interface ConversionFunnelInput {
  activatedStudentsCount: number;
  assessmentCompletedStudentsCount: number;
  reportGeneratedStudentsCount: number;
  studentsWithCompletedTaskCount: number;
  studentsParticipatedActivitiesCount: number;
}

export interface ConversionFunnelStageResult {
  stageCode: FunnelStageDefinition["code"];
  count: number;
  conversionFromPrevious: number;
}

export const calculateConversionFunnel = (
  input: ConversionFunnelInput
): ConversionFunnelStageResult[] => {
  const counts: Array<{ stageCode: FunnelStageDefinition["code"]; count: number }> = [
    { stageCode: "activated_students", count: input.activatedStudentsCount },
    {
      stageCode: "assessment_completed_students",
      count: input.assessmentCompletedStudentsCount
    },
    {
      stageCode: "report_generated_students",
      count: input.reportGeneratedStudentsCount
    },
    {
      stageCode: "task_completed_students",
      count: input.studentsWithCompletedTaskCount
    },
    {
      stageCode: "activity_participated_students",
      count: input.studentsParticipatedActivitiesCount
    }
  ];

  return counts.map((item, index) => {
    if (index === 0) {
      return {
        stageCode: item.stageCode,
        count: item.count,
        conversionFromPrevious: item.count > 0 ? 1 : 0
      };
    }

    const previousCount = counts[index - 1].count;

    return {
      stageCode: item.stageCode,
      count: item.count,
      conversionFromPrevious: safeDivide(item.count, previousCount)
    };
  });
};

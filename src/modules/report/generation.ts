export type ReportDirection = "employment" | "postgraduate" | "civil_service";

export interface ReportGenerationInput {
  studentNo: string;
  dimensionScores: {
    interest: number;
    ability: number;
    value: number;
  };
  recommendation: {
    direction: ReportDirection;
    reason: string;
  };
}

export interface GeneratedReport {
  direction: ReportDirection;
  markdown: string;
}

export interface GenerateAllReportsResult {
  reports: GeneratedReport[];
}

export interface ReportGenerationService {
  generateAllReports(input: ReportGenerationInput): Promise<GenerateAllReportsResult>;
}

const resolveDirectionTitle = (direction: ReportDirection): string => {
  switch (direction) {
    case "employment":
      return "就业发展报告";
    case "postgraduate":
      return "考研发展报告";
    case "civil_service":
      return "考公发展报告";
    default:
      return "发展报告";
  }
};

const buildMarkdown = (direction: ReportDirection, input: ReportGenerationInput): string => {
  return [
    `# ${resolveDirectionTitle(direction)}`,
    "",
    `- 学号：${input.studentNo}`,
    `- 兴趣维度：${input.dimensionScores.interest}`,
    `- 能力维度：${input.dimensionScores.ability}`,
    `- 价值维度：${input.dimensionScores.value}`,
    "",
    "## 结论摘要",
    `推荐方向：${input.recommendation.direction}`,
    `解释：${input.recommendation.reason}`,
    "",
    "## 下一步建议",
    "1. 完成阶段目标拆解并形成周计划",
    "2. 结合目标方向补齐关键能力短板",
    "3. 持续复盘并按月更新行动方案"
  ].join("\n");
};

export const createReportGenerationService = (): ReportGenerationService => {
  return {
    async generateAllReports(input: ReportGenerationInput): Promise<GenerateAllReportsResult> {
      return {
        reports: (["employment", "postgraduate", "civil_service"] as const).map((direction) => ({
          direction,
          markdown: buildMarkdown(direction, input)
        }))
      };
    }
  };
};

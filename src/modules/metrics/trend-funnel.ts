import type { DashboardFilters } from "./aggregation.js";
import {
  METRICS_DICTIONARY_VERSION,
  calculateConversionFunnel,
  type ConversionFunnelStageResult
} from "./dictionary.js";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

export interface DashboardMetricStudentDateRecord {
  studentId: number;
  date: string;
}

export interface DashboardTrendFunnelQueryInput {
  filters: DashboardFilters;
  dateRange: DashboardDateRange;
}

export interface DashboardTrendFunnelRepository {
  listActivatedStudents(
    input: DashboardTrendFunnelQueryInput
  ): Promise<DashboardMetricStudentDateRecord[]>;
  listAssessmentCompletedStudents(
    input: DashboardTrendFunnelQueryInput
  ): Promise<DashboardMetricStudentDateRecord[]>;
  listReportGeneratedStudents(
    input: DashboardTrendFunnelQueryInput
  ): Promise<DashboardMetricStudentDateRecord[]>;
  listTaskCompletedStudents(
    input: DashboardTrendFunnelQueryInput
  ): Promise<DashboardMetricStudentDateRecord[]>;
  listActivityParticipatedStudents(
    input: DashboardTrendFunnelQueryInput
  ): Promise<DashboardMetricStudentDateRecord[]>;
}

export interface DashboardTrendPoint {
  date: string;
  activatedStudentsCount: number;
  assessmentCompletedStudentsCount: number;
  reportGeneratedStudentsCount: number;
  taskCompletedStudentsCount: number;
  activityParticipatedStudentsCount: number;
}

export interface DashboardTrendFunnelResult {
  dictionaryVersion: string;
  dateRange: DashboardDateRange;
  trend: DashboardTrendPoint[];
  funnel: ConversionFunnelStageResult[];
}

export interface GetDashboardTrendFunnelInput {
  filters: DashboardFilters;
  startDate?: string;
  endDate?: string;
}

export interface DashboardTrendFunnelService {
  getTrendAndFunnel(input: GetDashboardTrendFunnelInput): Promise<DashboardTrendFunnelResult>;
}

export interface CreateDashboardTrendFunnelServiceInput {
  dashboardTrendFunnelRepo: DashboardTrendFunnelRepository;
  nowProvider?: () => Date;
}

export class InvalidDashboardDateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDashboardDateRangeError";
  }
}

const parseDateOnly = (rawDate: string): Date | null => {
  const matched = DATE_PATTERN.exec(rawDate);
  if (!matched) {
    return null;
  }

  const year = Number.parseInt(matched[1], 10);
  const month = Number.parseInt(matched[2], 10);
  const day = Number.parseInt(matched[3], 10);

  const date = new Date(Date.UTC(year, month - 1, day));

  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;

  return isValidDate ? date : null;
};

const formatDateOnly = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};

const resolveDateRange = ({
  startDate,
  endDate,
  nowProvider
}: {
  startDate?: string;
  endDate?: string;
  nowProvider: () => Date;
}): DashboardDateRange => {
  const today = formatDateOnly(nowProvider());
  const resolvedEndDate = endDate ?? today;
  const parsedEndDate = parseDateOnly(resolvedEndDate);

  if (!parsedEndDate) {
    throw new InvalidDashboardDateRangeError("endDate must be YYYY-MM-DD");
  }

  const resolvedStartDate =
    startDate ?? formatDateOnly(addDays(new Date(parsedEndDate.getTime()), -29));
  const parsedStartDate = parseDateOnly(resolvedStartDate);

  if (!parsedStartDate) {
    throw new InvalidDashboardDateRangeError("startDate must be YYYY-MM-DD");
  }

  if (parsedStartDate.getTime() > parsedEndDate.getTime()) {
    throw new InvalidDashboardDateRangeError("startDate must be less than or equal to endDate");
  }

  return {
    startDate: resolvedStartDate,
    endDate: resolvedEndDate
  };
};

const listDates = (dateRange: DashboardDateRange): string[] => {
  const start = parseDateOnly(dateRange.startDate);
  const end = parseDateOnly(dateRange.endDate);

  if (!start || !end) {
    return [];
  }

  const dates: string[] = [];
  let cursor = new Date(start.getTime());

  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatDateOnly(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates;
};

const createEmptyTrendPoint = (date: string): DashboardTrendPoint => ({
  date,
  activatedStudentsCount: 0,
  assessmentCompletedStudentsCount: 0,
  reportGeneratedStudentsCount: 0,
  taskCompletedStudentsCount: 0,
  activityParticipatedStudentsCount: 0
});

const countByDate = (
  records: DashboardMetricStudentDateRecord[],
  trendMap: Map<string, DashboardTrendPoint>,
  updater: (point: DashboardTrendPoint) => void
): void => {
  const seen = new Set<string>();

  for (const record of records) {
    const point = trendMap.get(record.date);
    if (!point) {
      continue;
    }

    const dedupeKey = `${record.date}:${record.studentId}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    updater(point);
  }
};

const countDistinctStudents = (
  records: DashboardMetricStudentDateRecord[],
  includedDateSet: Set<string>
): number => {
  const students = new Set<number>();

  for (const record of records) {
    if (!includedDateSet.has(record.date)) {
      continue;
    }

    students.add(record.studentId);
  }

  return students.size;
};

export const createDashboardTrendFunnelService = ({
  dashboardTrendFunnelRepo,
  nowProvider = () => new Date()
}: CreateDashboardTrendFunnelServiceInput): DashboardTrendFunnelService => {
  return {
    async getTrendAndFunnel({
      filters,
      startDate,
      endDate
    }: GetDashboardTrendFunnelInput): Promise<DashboardTrendFunnelResult> {
      const dateRange = resolveDateRange({
        startDate,
        endDate,
        nowProvider
      });

      const queryInput: DashboardTrendFunnelQueryInput = {
        filters,
        dateRange
      };

      const [
        activatedStudents,
        assessmentCompletedStudents,
        reportGeneratedStudents,
        taskCompletedStudents,
        activityParticipatedStudents
      ] = await Promise.all([
        dashboardTrendFunnelRepo.listActivatedStudents(queryInput),
        dashboardTrendFunnelRepo.listAssessmentCompletedStudents(queryInput),
        dashboardTrendFunnelRepo.listReportGeneratedStudents(queryInput),
        dashboardTrendFunnelRepo.listTaskCompletedStudents(queryInput),
        dashboardTrendFunnelRepo.listActivityParticipatedStudents(queryInput)
      ]);

      const dateSeries = listDates(dateRange);
      const trendMap = new Map<string, DashboardTrendPoint>(
        dateSeries.map((date) => [date, createEmptyTrendPoint(date)])
      );

      countByDate(activatedStudents, trendMap, (point) => {
        point.activatedStudentsCount += 1;
      });
      countByDate(assessmentCompletedStudents, trendMap, (point) => {
        point.assessmentCompletedStudentsCount += 1;
      });
      countByDate(reportGeneratedStudents, trendMap, (point) => {
        point.reportGeneratedStudentsCount += 1;
      });
      countByDate(taskCompletedStudents, trendMap, (point) => {
        point.taskCompletedStudentsCount += 1;
      });
      countByDate(activityParticipatedStudents, trendMap, (point) => {
        point.activityParticipatedStudentsCount += 1;
      });

      const includedDateSet = new Set(dateSeries);
      const funnel = calculateConversionFunnel({
        activatedStudentsCount: countDistinctStudents(activatedStudents, includedDateSet),
        assessmentCompletedStudentsCount: countDistinctStudents(
          assessmentCompletedStudents,
          includedDateSet
        ),
        reportGeneratedStudentsCount: countDistinctStudents(reportGeneratedStudents, includedDateSet),
        studentsWithCompletedTaskCount: countDistinctStudents(taskCompletedStudents, includedDateSet),
        studentsParticipatedActivitiesCount: countDistinctStudents(
          activityParticipatedStudents,
          includedDateSet
        )
      });

      return {
        dictionaryVersion: METRICS_DICTIONARY_VERSION,
        dateRange,
        trend: dateSeries.map((date) => trendMap.get(date) ?? createEmptyTrendPoint(date)),
        funnel
      };
    }
  };
};

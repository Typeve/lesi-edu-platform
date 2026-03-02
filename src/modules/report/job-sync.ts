import type { GeneratedReport } from "./generation.js";

export interface PersistReportJobInput {
  studentNo: string;
  payloadJson: string;
  status: "done";
  createdAt: Date;
}

export interface ReportJobSyncRepository {
  createJob(input: PersistReportJobInput): Promise<number>;
}

export interface SyncGeneratedReportsInput {
  studentNo: string;
  reports: GeneratedReport[];
}

export interface SyncGeneratedReportsResult {
  jobId: number;
  status: "done";
}

export interface ReportJobSyncService {
  syncGeneratedReports(input: SyncGeneratedReportsInput): Promise<SyncGeneratedReportsResult>;
}

export interface CreateReportJobSyncServiceInput {
  reportJobRepo: ReportJobSyncRepository;
}

export const createReportJobSyncService = ({
  reportJobRepo
}: CreateReportJobSyncServiceInput): ReportJobSyncService => {
  return {
    async syncGeneratedReports({
      studentNo,
      reports
    }: SyncGeneratedReportsInput): Promise<SyncGeneratedReportsResult> {
      const payload = {
        studentNo,
        generatedAt: new Date().toISOString(),
        reportCount: reports.length,
        directions: reports.map((item) => item.direction),
        reports
      };

      const jobId = await reportJobRepo.createJob({
        studentNo,
        payloadJson: JSON.stringify(payload),
        status: "done",
        createdAt: new Date()
      });

      return {
        jobId,
        status: "done"
      };
    }
  };
};

export interface TeacherStudentDetailRepository {
  isStudentAuthorized(teacherId: string, studentId: number): Promise<boolean>;
  getStudentProfile(studentId: number): Promise<{
    studentId: number;
    studentNo: string;
    name: string;
  } | null>;
  getAssessmentSummary(studentId: number): Promise<{ done: boolean }>;
  getReportSummary(studentId: number): Promise<{ count: number }>;
  getTaskSummary(studentId: number): Promise<{ count: number }>;
  listCertificateFiles(studentId: number): Promise<
    Array<{
      fileId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    }>
  >;
}

export interface TeacherStudentDetailService {
  getStudentDetail(input: { teacherId: string; studentId: number }): Promise<{
    profile: { studentId: number; studentNo: string; name: string };
    assessment: { done: boolean };
    report: { count: number };
    task: { count: number };
    certificateFiles: Array<{
      fileId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  }>;
}

export interface CreateTeacherStudentDetailServiceInput {
  teacherStudentDetailRepo: TeacherStudentDetailRepository;
}

export class TeacherStudentDetailForbiddenError extends Error {
  constructor() {
    super("forbidden");
    this.name = "TeacherStudentDetailForbiddenError";
  }
}

export class TeacherStudentDetailNotFoundError extends Error {
  constructor() {
    super("student not found");
    this.name = "TeacherStudentDetailNotFoundError";
  }
}

export const createTeacherStudentDetailService = ({
  teacherStudentDetailRepo
}: CreateTeacherStudentDetailServiceInput): TeacherStudentDetailService => {
  return {
    async getStudentDetail({ teacherId, studentId }) {
      const authorized = await teacherStudentDetailRepo.isStudentAuthorized(teacherId, studentId);
      if (!authorized) {
        throw new TeacherStudentDetailForbiddenError();
      }

      const profile = await teacherStudentDetailRepo.getStudentProfile(studentId);
      if (!profile) {
        throw new TeacherStudentDetailNotFoundError();
      }

      const [assessment, report, task, certificateFiles] = await Promise.all([
        teacherStudentDetailRepo.getAssessmentSummary(studentId),
        teacherStudentDetailRepo.getReportSummary(studentId),
        teacherStudentDetailRepo.getTaskSummary(studentId),
        teacherStudentDetailRepo.listCertificateFiles(studentId)
      ]);

      return {
        profile,
        assessment,
        report,
        task,
        certificateFiles
      };
    }
  };
};

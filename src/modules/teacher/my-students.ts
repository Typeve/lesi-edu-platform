export type AssessmentStatusFilter = "done" | "pending";
export type ReportStatusFilter = "generated" | "pending";

export interface TeacherMyStudentsFilter {
  classId?: number;
  majorId?: number;
  grade?: number;
  assessmentStatus?: AssessmentStatusFilter;
  reportStatus?: ReportStatusFilter;
}

export interface TeacherMyStudentsQuery {
  teacherId: string;
  page: number;
  pageSize: number;
  filters: TeacherMyStudentsFilter;
}

export interface TeacherStudentRow {
  studentId: number;
  studentNo: string;
  name: string;
  classId: number;
  className: string;
  majorId: number | null;
  majorName: string | null;
  grade: number | null;
  assessmentDone: boolean;
  reportGenerated: boolean;
}

export interface TeacherMyStudentsRepository {
  listAuthorizedStudents(query: TeacherMyStudentsQuery): Promise<{
    total: number;
    rows: TeacherStudentRow[];
  }>;
}

export interface TeacherMyStudentsService {
  getMyStudents(query: TeacherMyStudentsQuery): Promise<{
    page: number;
    pageSize: number;
    total: number;
    items: TeacherStudentRow[];
  }>;
}

export interface CreateTeacherMyStudentsServiceInput {
  teacherMyStudentsRepo: TeacherMyStudentsRepository;
}

export const createTeacherMyStudentsService = ({
  teacherMyStudentsRepo
}: CreateTeacherMyStudentsServiceInput): TeacherMyStudentsService => {
  return {
    async getMyStudents(query: TeacherMyStudentsQuery) {
      const safePage = Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
      const safePageSize =
        Number.isInteger(query.pageSize) && query.pageSize > 0 && query.pageSize <= 100 ? query.pageSize : 20;

      const result = await teacherMyStudentsRepo.listAuthorizedStudents({
        ...query,
        page: safePage,
        pageSize: safePageSize
      });

      return {
        page: safePage,
        pageSize: safePageSize,
        total: result.total,
        items: result.rows
      };
    }
  };
};

import { Hono } from "hono";
import type {
  AssessmentStatusFilter,
  ReportStatusFilter,
  TeacherMyStudentsService
} from "../modules/teacher/my-students.js";

export interface TeacherRouteDependencies {
  teacherMyStudentsService: Pick<TeacherMyStudentsService, "getMyStudents">;
}

const parsePositiveInteger = (raw: string | undefined): number | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (!/^[1-9]\d*$/.test(raw)) {
    return undefined;
  }
  return Number.parseInt(raw, 10);
};

const parseAssessmentStatus = (raw: string | undefined): AssessmentStatusFilter | undefined => {
  if (raw === "done" || raw === "pending") {
    return raw;
  }
  return undefined;
};

const parseReportStatus = (raw: string | undefined): ReportStatusFilter | undefined => {
  if (raw === "generated" || raw === "pending") {
    return raw;
  }
  return undefined;
};

export const createTeacherRoutes = ({ teacherMyStudentsService }: TeacherRouteDependencies) => {
  const teacher = new Hono();

  teacher.get("/my-students", async (c) => {
    const teacherId = c.req.header("x-teacher-id")?.trim();
    if (!teacherId) {
      return c.json({ message: "teacher id required" }, 401);
    }

    const page = parsePositiveInteger(c.req.query("page")) ?? 1;
    const pageSize = parsePositiveInteger(c.req.query("pageSize")) ?? 20;

    const result = await teacherMyStudentsService.getMyStudents({
      teacherId,
      page,
      pageSize,
      filters: {
        classId: parsePositiveInteger(c.req.query("classId")),
        majorId: parsePositiveInteger(c.req.query("majorId")),
        grade: parsePositiveInteger(c.req.query("grade")),
        assessmentStatus: parseAssessmentStatus(c.req.query("assessmentStatus")),
        reportStatus: parseReportStatus(c.req.query("reportStatus"))
      }
    });

    return c.json(result, 200);
  });

  return teacher;
};

export default createTeacherRoutes;

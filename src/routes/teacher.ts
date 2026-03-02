import { Hono } from "hono";
import type {
  AssessmentStatusFilter,
  ReportStatusFilter,
  TeacherMyStudentsService
} from "../modules/teacher/my-students.js";
import {
  TeacherStudentDetailForbiddenError,
  TeacherStudentDetailNotFoundError,
  type TeacherStudentDetailService
} from "../modules/teacher/student-detail.js";
import {
  TeacherActivityForbiddenError,
  type TeacherActivityExecutionService
} from "../modules/teacher/activity-execution.js";

export interface TeacherRouteDependencies {
  teacherMyStudentsService: Pick<TeacherMyStudentsService, "getMyStudents">;
  teacherStudentDetailService?: Pick<TeacherStudentDetailService, "getStudentDetail">;
  teacherActivityExecutionService?: Pick<TeacherActivityExecutionService, "executeActivity">;
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

export const createTeacherRoutes = ({
  teacherMyStudentsService,
  teacherStudentDetailService = {
    async getStudentDetail() {
      throw new Error("teacherStudentDetailService is not configured");
    }
  },
  teacherActivityExecutionService = {
    async executeActivity() {
      throw new Error("teacherActivityExecutionService is not configured");
    }
  }
}: TeacherRouteDependencies) => {
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

  teacher.get("/students/:id/detail", async (c) => {
    const teacherId = c.req.header("x-teacher-id")?.trim();
    if (!teacherId) {
      return c.json({ message: "teacher id required" }, 401);
    }

    const studentId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return c.json({ message: "invalid student id" }, 400);
    }

    try {
      const result = await teacherStudentDetailService.getStudentDetail({
        teacherId,
        studentId
      });
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof TeacherStudentDetailForbiddenError) {
        return c.json({ message: "forbidden" }, 403);
      }
      if (error instanceof TeacherStudentDetailNotFoundError) {
        return c.json({ message: "student not found" }, 404);
      }
      throw error;
    }
  });

  teacher.post("/activities/:id/execute", async (c) => {
    const teacherId = c.req.header("x-teacher-id")?.trim();
    if (!teacherId) {
      return c.json({ message: "teacher id required" }, 401);
    }

    const activityId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return c.json({ message: "invalid activity id" }, 400);
    }

    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    try {
      const result = await teacherActivityExecutionService.executeActivity({
        teacherId,
        activityId,
        payload
      });
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof TeacherActivityForbiddenError) {
        return c.json({ message: "forbidden" }, 403);
      }
      throw error;
    }
  });

  return teacher;
};

export default createTeacherRoutes;

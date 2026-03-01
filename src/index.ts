import { serve } from "@hono/node-server";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import path from "node:path";
import { env } from "./config/env.js";
import { db } from "./db/client.js";
import {
  activities,
  auditLogs,
  certificateFiles,
  classes,
  certificates,
  colleges,
  majors,
  profiles,
  reports,
  students,
  tasks,
  teacherClassGrants,
  teacherStudentGrants
} from "./db/schema.js";
import { createStudentAuthMiddleware } from "./middleware/auth.js";
import { createResourceAuthorizationMiddleware } from "./middleware/resource-authorization.js";
import { createActivityService } from "./modules/activity/service.js";
import { createAuditLogService } from "./modules/audit/service.js";
import { createAuthorizationGrantService } from "./modules/authorization/grant-service.js";
import { createDashboardDimensionAggregationService } from "./modules/metrics/aggregation.js";
import { createResourceAuthorizationService, type ResourceType } from "./modules/authorization/service.js";
import { bcryptPasswordHasher, bcryptPasswordVerifier } from "./modules/auth/password.js";
import { createStudentAuthService } from "./modules/auth/service.js";
import { createJwtTokenSigner, createJwtTokenVerifier } from "./modules/auth/token.js";
import { createExcelImportValidationService } from "./modules/import/excel-validation.js";
import { createCertificateUploadService } from "./modules/upload/certificate-upload.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createAuthRoutes } from "./routes/auth.js";
import healthRoutes from "./routes/health.js";
import { createResourcesRoutes } from "./routes/resources.js";
import { createStudentRoutes } from "./routes/student.js";

const studentRepo = {
  async findStudentByNo(studentNo: string) {
    const records = await db
      .select({
        id: students.id,
        studentNo: students.studentNo,
        passwordHash: students.passwordHash,
        mustChangePassword: students.mustChangePassword
      })
      .from(students)
      .where(eq(students.studentNo, studentNo))
      .limit(1);

    return records[0] ?? null;
  },
  async findStudentById(studentId: number) {
    const records = await db
      .select({
        id: students.id,
        studentNo: students.studentNo,
        passwordHash: students.passwordHash,
        mustChangePassword: students.mustChangePassword
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    return records[0] ?? null;
  },
  async updateStudentPassword({ studentId, passwordHash, passwordUpdatedAt, mustChangePassword }: {
    studentId: number;
    passwordHash: string;
    passwordUpdatedAt: Date;
    mustChangePassword: boolean;
  }) {
    await db
      .update(students)
      .set({
        passwordHash,
        passwordUpdatedAt,
        mustChangePassword
      })
      .where(eq(students.id, studentId));
  }
};

const studentAuthService = createStudentAuthService({
  studentRepo,
  passwordVerifier: bcryptPasswordVerifier,
  passwordHasher: bcryptPasswordHasher,
  tokenSigner: createJwtTokenSigner({
    secret: env.JWT_SECRET,
    expiresInDays: env.JWT_EXPIRES_IN_DAYS
  })
});

const requireStudentAuth = createStudentAuthMiddleware({
  tokenVerifier: createJwtTokenVerifier({
    secret: env.JWT_SECRET
  }),
  studentRepo
});

const authorizationRepo = {
  async findResourceStudentId(resourceType: ResourceType, resourceId: number): Promise<number | null> {
    switch (resourceType) {
      case "report": {
        const records = await db
          .select({ studentId: reports.studentId })
          .from(reports)
          .where(eq(reports.id, resourceId))
          .limit(1);
        return records[0]?.studentId ?? null;
      }
      case "task": {
        const records = await db
          .select({ studentId: tasks.studentId })
          .from(tasks)
          .where(eq(tasks.id, resourceId))
          .limit(1);
        return records[0]?.studentId ?? null;
      }
      case "certificate": {
        const records = await db
          .select({ studentId: certificates.studentId })
          .from(certificates)
          .where(eq(certificates.id, resourceId))
          .limit(1);
        return records[0]?.studentId ?? null;
      }
      case "profile": {
        const records = await db
          .select({ studentId: profiles.studentId })
          .from(profiles)
          .where(eq(profiles.id, resourceId))
          .limit(1);
        return records[0]?.studentId ?? null;
      }
      default:
        return null;
    }
  },
  async hasTeacherStudentGrant(teacherId: string, studentId: number): Promise<boolean> {
    const records = await db
      .select({ id: teacherStudentGrants.id })
      .from(teacherStudentGrants)
      .where(
        and(
          eq(teacherStudentGrants.teacherId, teacherId),
          eq(teacherStudentGrants.studentId, studentId)
        )
      )
      .limit(1);

    return records.length > 0;
  },
  async findStudentClassId(studentId: number): Promise<number | null> {
    const records = await db
      .select({ classId: students.classId })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    return records[0]?.classId ?? null;
  },
  async hasTeacherClassGrant(teacherId: string, classId: number): Promise<boolean> {
    const records = await db
      .select({ id: teacherClassGrants.id })
      .from(teacherClassGrants)
      .where(and(eq(teacherClassGrants.teacherId, teacherId), eq(teacherClassGrants.classId, classId)))
      .limit(1);

    return records.length > 0;
  }
};

const resourceAuthorizationService = createResourceAuthorizationService({
  authorizationRepo
});

const authorizationGrantRepo = {
  async assignStudentGrant(teacherId: string, studentId: number): Promise<void> {
    const existing = await db
      .select({ id: teacherStudentGrants.id })
      .from(teacherStudentGrants)
      .where(and(eq(teacherStudentGrants.teacherId, teacherId), eq(teacherStudentGrants.studentId, studentId)))
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    await db.insert(teacherStudentGrants).values({
      teacherId,
      studentId
    });
  },
  async revokeStudentGrant(teacherId: string, studentId: number): Promise<void> {
    await db
      .delete(teacherStudentGrants)
      .where(and(eq(teacherStudentGrants.teacherId, teacherId), eq(teacherStudentGrants.studentId, studentId)));
  },
  async assignClassGrant(teacherId: string, classId: number): Promise<void> {
    const existing = await db
      .select({ id: teacherClassGrants.id })
      .from(teacherClassGrants)
      .where(and(eq(teacherClassGrants.teacherId, teacherId), eq(teacherClassGrants.classId, classId)))
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    await db.insert(teacherClassGrants).values({
      teacherId,
      classId
    });
  },
  async revokeClassGrant(teacherId: string, classId: number): Promise<void> {
    await db
      .delete(teacherClassGrants)
      .where(and(eq(teacherClassGrants.teacherId, teacherId), eq(teacherClassGrants.classId, classId)));
  }
};

const authorizationGrantService = createAuthorizationGrantService({
  authorizationGrantRepo
});

const activityRepo = {
  async publishActivity({
    activityType,
    title
  }: {
    activityType: "course" | "competition" | "project";
    title: string;
  }): Promise<void> {
    await db.insert(activities).values({
      activityType,
      title
    });
  }
};

const activityService = createActivityService({
  activityRepo
});

const auditLogRepo = {
  async createAuditLog({
    operator,
    action,
    target,
    detail,
    createdAt
  }: {
    operator: string;
    action: "authorization_grant" | "authorization_revoke" | "password_reset" | "activity_publish";
    target: string;
    detail: string | null;
    createdAt: Date;
  }): Promise<void> {
    await db.insert(auditLogs).values({
      operator,
      action,
      target,
      detail,
      createdAt
    });
  }
};

const auditLogService = createAuditLogService({
  auditLogRepo
});

const excelImportValidationService = createExcelImportValidationService();

const dashboardMetricsRepo = {
  async listClassMetricRecords(filters: {
    schoolId?: number;
    collegeId?: number;
    majorId?: number;
    classId?: number;
  }) {
    const conditions = [];

    if (filters.schoolId) {
      conditions.push(eq(colleges.schoolId, filters.schoolId));
    }
    if (filters.collegeId) {
      conditions.push(eq(classes.collegeId, filters.collegeId));
    }
    if (filters.majorId) {
      conditions.push(eq(classes.majorId, filters.majorId));
    }
    if (filters.classId) {
      conditions.push(eq(classes.id, filters.classId));
    }

    const baseQuery = db
      .select({
        schoolId: colleges.schoolId,
        collegeId: colleges.id,
        collegeName: colleges.name,
        majorId: majors.id,
        majorName: majors.name,
        classId: classes.id,
        className: classes.name
      })
      .from(classes)
      .innerJoin(colleges, eq(classes.collegeId, colleges.id))
      .leftJoin(majors, eq(classes.majorId, majors.id));

    const classRows =
      conditions.length > 0 ? await baseQuery.where(and(...conditions)) : await baseQuery;

    const records: Array<{
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
    }> = [];

    for (const classRow of classRows) {
      const studentsInClass = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.classId, classRow.classId));

      const activatedStudentsCount = studentsInClass.length;

      const profileRows = await db
        .select({ studentId: profiles.studentId })
        .from(profiles)
        .innerJoin(students, eq(profiles.studentId, students.id))
        .where(eq(students.classId, classRow.classId));
      const assessmentCompletedStudentsCount = new Set(profileRows.map((row) => row.studentId)).size;

      const reportRows = await db
        .select({ studentId: reports.studentId, direction: reports.direction })
        .from(reports)
        .innerJoin(students, eq(reports.studentId, students.id))
        .where(eq(students.classId, classRow.classId));
      const reportGeneratedStudentsCount = new Set(reportRows.map((row) => row.studentId)).size;

      const taskRows = await db
        .select({ studentId: tasks.studentId })
        .from(tasks)
        .innerJoin(students, eq(tasks.studentId, students.id))
        .where(eq(students.classId, classRow.classId));
      const studentsWithAssignedTasksCount = new Set(taskRows.map((row) => row.studentId)).size;
      const studentsWithCompletedTaskCount = studentsWithAssignedTasksCount;

      const certificateRows = await db
        .select({ studentId: certificates.studentId })
        .from(certificates)
        .innerJoin(students, eq(certificates.studentId, students.id))
        .where(eq(students.classId, classRow.classId));
      const studentsParticipatedActivitiesCount = new Set(
        certificateRows.map((row) => row.studentId)
      ).size;

      records.push({
        schoolId: classRow.schoolId,
        collegeId: classRow.collegeId,
        collegeName: classRow.collegeName,
        majorId: classRow.majorId,
        majorName: classRow.majorName,
        classId: classRow.classId,
        className: classRow.className,
        activatedStudentsCount,
        assessmentCompletedStudentsCount,
        reportGeneratedStudentsCount,
        studentsWithAssignedTasksCount,
        studentsWithCompletedTaskCount,
        studentsEligibleForActivitiesCount: activatedStudentsCount,
        studentsParticipatedActivitiesCount,
        reportDirectionEmploymentCount: reportRows.filter((row) => row.direction === "employment").length,
        reportDirectionPostgraduateCount: reportRows.filter((row) => row.direction === "postgraduate").length,
        reportDirectionCivilServiceCount: reportRows.filter((row) => row.direction === "civil_service").length
      });
    }

    return records;
  }
};

const dashboardDimensionAggregationService = createDashboardDimensionAggregationService({
  dashboardMetricsRepo
});

const certificateFileRepo = {
  async createCertificateFile({
    fileId,
    studentId,
    originalName,
    mimeType,
    sizeBytes,
    storagePath,
    createdAt
  }: {
    fileId: string;
    studentId: number;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    createdAt: Date;
  }): Promise<void> {
    await db.insert(certificateFiles).values({
      fileId,
      studentId,
      originalName,
      mimeType,
      sizeBytes,
      storagePath,
      createdAt
    });
  }
};

const certificateUploadService = createCertificateUploadService({
  certificateFileRepo,
  uploadDir: path.resolve(process.cwd(), "uploads/certificates")
});

const createResourceAuthorization = (resourceType: ResourceType) =>
  createResourceAuthorizationMiddleware({
    resourceType,
    authorizationService: resourceAuthorizationService
  });

const app = new Hono();

app.get("/", (c) =>
  c.json({
    service: "lesi-edu-platform-api",
    status: "running"
  })
);

app.route("/", healthRoutes);
app.route("/auth", createAuthRoutes({ studentAuthService, requireStudentAuth }));
app.route(
  "/admin",
  createAdminRoutes({
    studentAuthService,
    authorizationGrantService,
    activityService,
    auditLogService,
    excelImportValidationService,
    dashboardDimensionAggregationService,
    adminApiKey: env.ADMIN_API_KEY
  })
);
app.route("/resources", createResourcesRoutes({ createResourceAuthorization }));
app.route("/student", createStudentRoutes({ requireStudentAuth, certificateUploadService }));

serve(
  {
    fetch: app.fetch,
    port: env.PORT
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);

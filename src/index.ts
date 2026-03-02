import { serve } from "@hono/node-server";
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { Hono } from "hono";
import path from "node:path";
import { env } from "./config/env.js";
import { db } from "./db/client.js";
import {
  assessmentSubmissions,
  activities,
  auditLogs,
  certificateFiles,
  classes,
  certificates,
  colleges,
  enrollmentProfiles,
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
import {
  createCachedDashboardDimensionAggregationService,
  createCachedDashboardTrendFunnelService,
  createInMemoryDashboardCacheStore
} from "./modules/metrics/cache.js";
import {
  createDashboardSlowQueryObserver,
  measureObservedAsync
} from "./modules/metrics/observability.js";
import {
  createDashboardTrendFunnelService,
  type DashboardTrendFunnelQueryInput
} from "./modules/metrics/trend-funnel.js";
import { createResourceAuthorizationService, type ResourceType } from "./modules/authorization/service.js";
import { bcryptPasswordHasher, bcryptPasswordVerifier } from "./modules/auth/password.js";
import { createStudentAuthService } from "./modules/auth/service.js";
import { createJwtTokenSigner, createJwtTokenVerifier } from "./modules/auth/token.js";
import { createStudentFirstLoginVerificationService } from "./modules/auth/first-login-verification.js";
import { createLikertAssessmentService } from "./modules/assessment/likert.js";
import { createLikertAssessmentResultService } from "./modules/assessment/result.js";
import { createRoleModelMatchingService } from "./modules/role-model/matching.js";
import { createEnrollmentProfileService } from "./modules/enrollment/profile.js";
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
        mustChangePassword: students.mustChangePassword,
        credentialNo: students.credentialNo,
        firstLoginVerifiedAt: students.firstLoginVerifiedAt
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
        mustChangePassword: students.mustChangePassword,
        credentialNo: students.credentialNo,
        firstLoginVerifiedAt: students.firstLoginVerifiedAt
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

const studentFirstLoginVerificationRepo = {
  async findStudentFirstLoginReference(studentId: number) {
    const records = await db
      .select({
        studentId: students.id,
        name: students.name,
        credentialNo: students.credentialNo,
        schoolName: colleges.name,
        majorName: majors.name,
        firstLoginVerifiedAt: students.firstLoginVerifiedAt
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .innerJoin(colleges, eq(classes.collegeId, colleges.id))
      .leftJoin(majors, eq(classes.majorId, majors.id))
      .where(eq(students.id, studentId))
      .limit(1);

    return records[0] ?? null;
  },
  async markStudentFirstLoginVerified({ studentId, verifiedAt }: { studentId: number; verifiedAt: Date }) {
    await db
      .update(students)
      .set({
        firstLoginVerifiedAt: verifiedAt
      })
      .where(eq(students.id, studentId));
  }
};

const studentFirstLoginVerificationService = createStudentFirstLoginVerificationService({
  studentFirstLoginVerificationRepo: studentFirstLoginVerificationRepo
});

const enrollmentProfileRepo = {
  async findEnrollmentProfileByStudentNo(studentNo: string) {
    const records = await db
      .select({
        studentNo: enrollmentProfiles.studentNo,
        name: enrollmentProfiles.name,
        schoolName: enrollmentProfiles.schoolName,
        majorName: enrollmentProfiles.majorName,
        score: enrollmentProfiles.score,
        admissionYear: enrollmentProfiles.admissionYear
      })
      .from(enrollmentProfiles)
      .where(eq(enrollmentProfiles.studentNo, studentNo))
      .limit(1);

    return records[0] ?? null;
  }
};

const enrollmentProfileService = createEnrollmentProfileService({
  enrollmentProfileRepo
});

const likertAssessmentSubmissionRepo = {
  async findSubmissionByStudentId(studentId: number) {
    const records = await db
      .select({
        id: assessmentSubmissions.id,
        studentId: assessmentSubmissions.studentId,
        answersJson: assessmentSubmissions.answersJson,
        answerCount: assessmentSubmissions.answerCount
      })
      .from(assessmentSubmissions)
      .where(eq(assessmentSubmissions.studentId, studentId))
      .limit(1);

    return records[0] ?? null;
  },
  async createSubmission({ studentId, answersJson, answerCount, submittedAt }: {
    studentId: number;
    answersJson: string;
    answerCount: number;
    submittedAt: Date;
  }) {
    const insertResult = await db
      .insert(assessmentSubmissions)
      .values({
        studentId,
        answersJson,
        answerCount,
        questionSetVersion: "v1",
        submittedAt,
        updatedAt: submittedAt
      });

    return Number(insertResult[0].insertId);
  },
  async updateSubmission({ id, answersJson, answerCount, submittedAt }: {
    id: number;
    studentId: number;
    answersJson: string;
    answerCount: number;
    submittedAt: Date;
  }) {
    await db
      .update(assessmentSubmissions)
      .set({
        answersJson,
        answerCount,
        submittedAt,
        updatedAt: submittedAt
      })
      .where(eq(assessmentSubmissions.id, id));
  }
};

const likertAssessmentService = createLikertAssessmentService({
  submissionRepo: likertAssessmentSubmissionRepo
});

const likertAssessmentResultService = createLikertAssessmentResultService({
  resultRepo: likertAssessmentSubmissionRepo
});

const roleModelMatchingRepo = {
  async findStudentEnrollmentProfile(studentNo: string) {
    const records = await db
      .select({
        studentNo: enrollmentProfiles.studentNo,
        schoolName: enrollmentProfiles.schoolName,
        majorName: enrollmentProfiles.majorName,
        score: enrollmentProfiles.score
      })
      .from(enrollmentProfiles)
      .where(eq(enrollmentProfiles.studentNo, studentNo))
      .limit(1);

    return records[0] ?? null;
  },
  async listRoleModelCandidates(direction: "employment" | "postgraduate" | "civil_service") {
    const records = await db
      .select({
        studentNo: enrollmentProfiles.studentNo,
        name: enrollmentProfiles.name,
        schoolName: enrollmentProfiles.schoolName,
        majorName: enrollmentProfiles.majorName,
        score: enrollmentProfiles.score,
        direction: reports.direction
      })
      .from(enrollmentProfiles)
      .innerJoin(students, eq(students.studentNo, enrollmentProfiles.studentNo))
      .innerJoin(reports, and(eq(reports.studentId, students.id), eq(reports.direction, direction)))
      .where(ne(students.studentNo, ""));

    return records.map((record) => ({
      studentNo: record.studentNo,
      name: record.name ?? "匿名榜样",
      schoolName: record.schoolName,
      majorName: record.majorName,
      score: record.score,
      direction: record.direction
    }));
  }
};

const roleModelMatchingService = createRoleModelMatchingService({
  roleModelRepo: roleModelMatchingRepo
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
const dashboardSlowQueryObserver = createDashboardSlowQueryObserver({
  slowQueryThresholdMs: env.METRICS_SLOW_QUERY_THRESHOLD_MS
});

const observeMetricsQuery = async <T>(queryName: string, run: () => Promise<T>): Promise<T> => {
  return measureObservedAsync({
    queryName,
    observer: dashboardSlowQueryObserver,
    run
  });
};

const dashboardMetricsRepo = {
  async listClassMetricRecords(filters: {
    schoolId?: number;
    collegeId?: number;
    majorId?: number;
    classId?: number;
  }) {
    return observeMetricsQuery("metrics.listClassMetricRecords", async () => {
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
    });
  }
};

const dashboardCacheStore = createInMemoryDashboardCacheStore();
const dashboardCacheConfig = {
  ttlMs: env.METRICS_CACHE_TTL_SECONDS * 1000,
  invalidationStrategy: env.METRICS_CACHE_INVALIDATION_STRATEGY
} as const;

const rawDashboardDimensionAggregationService = createDashboardDimensionAggregationService({
  dashboardMetricsRepo
});

const dashboardDimensionAggregationService = createCachedDashboardDimensionAggregationService({
  dashboardDimensionAggregationService: rawDashboardDimensionAggregationService,
  cacheStore: dashboardCacheStore,
  cacheConfig: dashboardCacheConfig
});

const toDateOnlyString = (value: Date | string): string => {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return value.slice(0, 10);
};

const toUtcDate = (dateOnly: string): Date => {
  return new Date(`${dateOnly}T00:00:00.000Z`);
};

const buildTrendFunnelConditions = (
  filters: DashboardTrendFunnelQueryInput["filters"]
) => {
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

  return conditions;
};

const dashboardTrendFunnelRepo = {
  async listActivatedStudents({ filters, dateRange }: DashboardTrendFunnelQueryInput) {
    return observeMetricsQuery("metrics.listActivatedStudents", async () => {
      const endExclusiveDate = toUtcDate(dateRange.endDate);
      endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);

      const rows = await db
        .select({
          studentId: students.id,
          createdAt: students.createdAt
        })
        .from(students)
        .innerJoin(classes, eq(students.classId, classes.id))
        .innerJoin(colleges, eq(classes.collegeId, colleges.id))
        .where(
          and(
            ...buildTrendFunnelConditions(filters),
            gte(students.createdAt, toUtcDate(dateRange.startDate)),
            lt(students.createdAt, endExclusiveDate)
          )
        );

      return rows.map((row) => ({
        studentId: row.studentId,
        date: toDateOnlyString(row.createdAt)
      }));
    });
  },
  async listAssessmentCompletedStudents({ filters, dateRange }: DashboardTrendFunnelQueryInput) {
    return observeMetricsQuery("metrics.listAssessmentCompletedStudents", async () => {
      const endExclusiveDate = toUtcDate(dateRange.endDate);
      endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);

      const rows = await db
        .select({
          studentId: profiles.studentId,
          createdAt: profiles.createdAt
        })
        .from(profiles)
        .innerJoin(students, eq(profiles.studentId, students.id))
        .innerJoin(classes, eq(students.classId, classes.id))
        .innerJoin(colleges, eq(classes.collegeId, colleges.id))
        .where(
          and(
            ...buildTrendFunnelConditions(filters),
            gte(profiles.createdAt, toUtcDate(dateRange.startDate)),
            lt(profiles.createdAt, endExclusiveDate)
          )
        );

      return rows.map((row) => ({
        studentId: row.studentId,
        date: toDateOnlyString(row.createdAt)
      }));
    });
  },
  async listReportGeneratedStudents({ filters, dateRange }: DashboardTrendFunnelQueryInput) {
    return observeMetricsQuery("metrics.listReportGeneratedStudents", async () => {
      const endExclusiveDate = toUtcDate(dateRange.endDate);
      endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);

      const rows = await db
        .select({
          studentId: reports.studentId,
          createdAt: reports.createdAt
        })
        .from(reports)
        .innerJoin(students, eq(reports.studentId, students.id))
        .innerJoin(classes, eq(students.classId, classes.id))
        .innerJoin(colleges, eq(classes.collegeId, colleges.id))
        .where(
          and(
            ...buildTrendFunnelConditions(filters),
            gte(reports.createdAt, toUtcDate(dateRange.startDate)),
            lt(reports.createdAt, endExclusiveDate)
          )
        );

      return rows.map((row) => ({
        studentId: row.studentId,
        date: toDateOnlyString(row.createdAt)
      }));
    });
  },
  async listTaskCompletedStudents({ filters, dateRange }: DashboardTrendFunnelQueryInput) {
    return observeMetricsQuery("metrics.listTaskCompletedStudents", async () => {
      const endExclusiveDate = toUtcDate(dateRange.endDate);
      endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);

      const rows = await db
        .select({
          studentId: tasks.studentId,
          createdAt: tasks.createdAt
        })
        .from(tasks)
        .innerJoin(students, eq(tasks.studentId, students.id))
        .innerJoin(classes, eq(students.classId, classes.id))
        .innerJoin(colleges, eq(classes.collegeId, colleges.id))
        .where(
          and(
            ...buildTrendFunnelConditions(filters),
            gte(tasks.createdAt, toUtcDate(dateRange.startDate)),
            lt(tasks.createdAt, endExclusiveDate)
          )
        );

      return rows.map((row) => ({
        studentId: row.studentId,
        date: toDateOnlyString(row.createdAt)
      }));
    });
  },
  async listActivityParticipatedStudents({ filters, dateRange }: DashboardTrendFunnelQueryInput) {
    return observeMetricsQuery("metrics.listActivityParticipatedStudents", async () => {
      const endExclusiveDate = toUtcDate(dateRange.endDate);
      endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);

      const rows = await db
        .select({
          studentId: certificates.studentId,
          createdAt: certificates.createdAt
        })
        .from(certificates)
        .innerJoin(students, eq(certificates.studentId, students.id))
        .innerJoin(classes, eq(students.classId, classes.id))
        .innerJoin(colleges, eq(classes.collegeId, colleges.id))
        .where(
          and(
            ...buildTrendFunnelConditions(filters),
            gte(certificates.createdAt, toUtcDate(dateRange.startDate)),
            lt(certificates.createdAt, endExclusiveDate)
          )
        );

      return rows.map((row) => ({
        studentId: row.studentId,
        date: toDateOnlyString(row.createdAt)
      }));
    });
  }
};

const rawDashboardTrendFunnelService = createDashboardTrendFunnelService({
  dashboardTrendFunnelRepo
});

const dashboardTrendFunnelService = createCachedDashboardTrendFunnelService({
  dashboardTrendFunnelService: rawDashboardTrendFunnelService,
  cacheStore: dashboardCacheStore,
  cacheConfig: dashboardCacheConfig
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
app.route(
  "/auth",
  createAuthRoutes({
    studentAuthService,
    studentFirstLoginVerificationService,
    enrollmentProfileService,
    requireStudentAuth
  })
);
app.route(
  "/admin",
  createAdminRoutes({
    studentAuthService,
    authorizationGrantService,
    activityService,
    auditLogService,
    excelImportValidationService,
    dashboardDimensionAggregationService,
    dashboardTrendFunnelService,
    adminApiKey: env.ADMIN_API_KEY
  })
);
app.route("/resources", createResourcesRoutes({ createResourceAuthorization }));
app.route(
  "/student",
  createStudentRoutes({
    requireStudentAuth,
    certificateUploadService,
    likertAssessmentService,
    likertAssessmentResultService,
    roleModelMatchingService
  })
);

serve(
  {
    fetch: app.fetch,
    port: env.PORT
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);

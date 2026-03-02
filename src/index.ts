import { serve } from "@hono/node-server";
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { Hono } from "hono";
import path from "node:path";
import { env } from "./config/env.js";
import { db } from "./db/client.js";
import {
  assessmentSubmissions,
  activityExecutionRecords,
  activities,
  auditLogs,
  certificateFiles,
  classes,
  certificates,
  colleges,
  enrollmentProfiles,
  majors,
  profiles,
  reportGenerationJobs,
  reports,
  students,
  taskCheckIns,
  tasks,
  teachers,
  teacherActivityAssignments,
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
import { createReportGenerationService } from "./modules/report/generation.js";
import { createReportJobSyncService } from "./modules/report/job-sync.js";
import { createTaskCheckInService } from "./modules/task/checkin.js";
import { createTeacherActivityExecutionService } from "./modules/teacher/activity-execution.js";
import { createTeacherMyStudentsService } from "./modules/teacher/my-students.js";
import { createTeacherStudentDetailService } from "./modules/teacher/student-detail.js";
import { createEnrollmentProfileService } from "./modules/enrollment/profile.js";
import { createExcelImportValidationService } from "./modules/import/excel-validation.js";
import { createCertificateUploadService } from "./modules/upload/certificate-upload.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createAuthRoutes } from "./routes/auth.js";
import healthRoutes from "./routes/health.js";
import { createResourcesRoutes } from "./routes/resources.js";
import { createStudentRoutes } from "./routes/student.js";
import { createTeacherRoutes } from "./routes/teacher.js";

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

const reportGenerationService = createReportGenerationService();
const reportJobRepo = {
  async createJob({ studentNo, payloadJson, status, createdAt }: {
    studentNo: string;
    payloadJson: string;
    status: "done";
    createdAt: Date;
  }) {
    const insertResult = await db
      .insert(reportGenerationJobs)
      .values({
        studentNo,
        payloadJson,
        status,
        createdAt
      });

    return Number(insertResult[0].insertId);
  }
};
const reportJobSyncService = createReportJobSyncService({
  reportJobRepo
});

const taskCheckInRepo = {
  async findTaskByIdAndStudentId(taskId: number, studentId: number) {
    const records = await db
      .select({
        id: tasks.id,
        studentId: tasks.studentId
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.studentId, studentId)))
      .limit(1);

    return records[0] ?? null;
  },
  async hasCertificateFileForStudent(studentId: number, fileId: string) {
    const records = await db
      .select({
        id: certificateFiles.id
      })
      .from(certificateFiles)
      .where(and(eq(certificateFiles.studentId, studentId), eq(certificateFiles.fileId, fileId)))
      .limit(1);

    return records.length > 0;
  },
  async upsertTaskCheckIn({ taskId, studentId, fileId, note, submittedAt }: {
    taskId: number;
    studentId: number;
    fileId: string | null;
    note: string | null;
    submittedAt: Date;
  }) {
    const existing = await db
      .select({
        id: taskCheckIns.id
      })
      .from(taskCheckIns)
      .where(and(eq(taskCheckIns.taskId, taskId), eq(taskCheckIns.studentId, studentId)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(taskCheckIns)
        .set({
          fileId,
          note,
          submittedAt
        })
        .where(eq(taskCheckIns.id, existing[0].id));
      return existing[0].id;
    }

    const insertResult = await db
      .insert(taskCheckIns)
      .values({
        taskId,
        studentId,
        fileId,
        note,
        submittedAt,
        createdAt: submittedAt
      });

    return Number(insertResult[0].insertId);
  }
};

const taskCheckInService = createTaskCheckInService({
  taskCheckInRepo
});

const teacherMyStudentsRepo = {
  async listAuthorizedStudents({ teacherId, page, pageSize, filters }: {
    teacherId: string;
    page: number;
    pageSize: number;
    filters: {
      classId?: number;
      majorId?: number;
      grade?: number;
      assessmentStatus?: "done" | "pending";
      reportStatus?: "generated" | "pending";
    };
  }) {
    const directGrantRows = await db
      .select({ studentId: teacherStudentGrants.studentId })
      .from(teacherStudentGrants)
      .where(eq(teacherStudentGrants.teacherId, teacherId));

    const classGrantRows = await db
      .select({ classId: teacherClassGrants.classId })
      .from(teacherClassGrants)
      .where(eq(teacherClassGrants.teacherId, teacherId));

    const classIds = new Set<number>(classGrantRows.map((item) => item.classId));
    const classStudentRows =
      classGrantRows.length > 0
        ? (await db
            .select({ studentId: students.id, classId: students.classId })
            .from(students))
            .filter((row) => classIds.has(row.classId))
            .map((row) => ({ studentId: row.studentId }))
        : [];

    const authorizedStudentIdSet = new Set<number>([
      ...directGrantRows.map((item) => item.studentId),
      ...classStudentRows.map((item) => item.studentId)
    ]);

    if (authorizedStudentIdSet.size === 0) {
      return { total: 0, rows: [] };
    }

    const authorizedStudents = await db
      .select({
        studentId: students.id,
        studentNo: students.studentNo,
        name: students.name,
        classId: classes.id,
        className: classes.name,
        majorId: classes.majorId,
        majorName: majors.name
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .leftJoin(majors, eq(classes.majorId, majors.id));

    let rows = authorizedStudents.filter((row) => authorizedStudentIdSet.has(row.studentId));

    if (filters.classId) {
      rows = rows.filter((row) => row.classId === filters.classId);
    }
    if (filters.majorId) {
      rows = rows.filter((row) => row.majorId === filters.majorId);
    }

    const studentNoList = rows.map((row) => row.studentNo);
    const assessmentRows =
      rows.length > 0
        ? await db
            .select({ studentId: assessmentSubmissions.studentId })
            .from(assessmentSubmissions)
        : [];
    const reportRows =
      rows.length > 0
        ? await db
            .select({ studentId: reports.studentId })
            .from(reports)
        : [];
    const enrollmentRows =
      studentNoList.length > 0
        ? await db
            .select({
              studentNo: enrollmentProfiles.studentNo,
              grade: enrollmentProfiles.admissionYear
            })
            .from(enrollmentProfiles)
        : [];

    const assessmentDoneSet = new Set<number>(assessmentRows.map((item) => item.studentId));
    const reportDoneSet = new Set<number>(reportRows.map((item) => item.studentId));
    const gradeByStudentNo = new Map<string, number | null>(
      enrollmentRows.map((item) => [item.studentNo, item.grade])
    );

    let enrichedRows = rows.map((row) => ({
      ...row,
      grade: gradeByStudentNo.get(row.studentNo) ?? null,
      assessmentDone: assessmentDoneSet.has(row.studentId),
      reportGenerated: reportDoneSet.has(row.studentId)
    }));

    if (filters.grade) {
      enrichedRows = enrichedRows.filter((row) => row.grade === filters.grade);
    }
    if (filters.assessmentStatus) {
      enrichedRows = enrichedRows.filter((row) =>
        filters.assessmentStatus === "done" ? row.assessmentDone : !row.assessmentDone
      );
    }
    if (filters.reportStatus) {
      enrichedRows = enrichedRows.filter((row) =>
        filters.reportStatus === "generated" ? row.reportGenerated : !row.reportGenerated
      );
    }

    enrichedRows.sort((left, right) => left.studentId - right.studentId);

    const total = enrichedRows.length;
    const offset = (page - 1) * pageSize;
    const pagedRows = enrichedRows.slice(offset, offset + pageSize);

    return {
      total,
      rows: pagedRows
    };
  }
};

const teacherMyStudentsService = createTeacherMyStudentsService({
  teacherMyStudentsRepo
});

const teacherStudentDetailRepo = {
  async isStudentAuthorized(teacherId: string, studentId: number) {
    const direct = await db
      .select({ id: teacherStudentGrants.id })
      .from(teacherStudentGrants)
      .where(and(eq(teacherStudentGrants.teacherId, teacherId), eq(teacherStudentGrants.studentId, studentId)))
      .limit(1);
    if (direct.length > 0) {
      return true;
    }

    const studentRow = await db
      .select({ classId: students.classId })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    if (!studentRow[0]) {
      return false;
    }

    const classGrant = await db
      .select({ id: teacherClassGrants.id })
      .from(teacherClassGrants)
      .where(and(eq(teacherClassGrants.teacherId, teacherId), eq(teacherClassGrants.classId, studentRow[0].classId)))
      .limit(1);
    return classGrant.length > 0;
  },
  async getStudentProfile(studentId: number) {
    const rows = await db
      .select({
        studentId: students.id,
        studentNo: students.studentNo,
        name: students.name
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    return rows[0] ?? null;
  },
  async getAssessmentSummary(studentId: number) {
    const rows = await db
      .select({ id: assessmentSubmissions.id })
      .from(assessmentSubmissions)
      .where(eq(assessmentSubmissions.studentId, studentId))
      .limit(1);
    return { done: rows.length > 0 };
  },
  async getReportSummary(studentId: number) {
    const rows = await db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.studentId, studentId));
    return { count: rows.length };
  },
  async getTaskSummary(studentId: number) {
    const rows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.studentId, studentId));
    return { count: rows.length };
  },
  async listCertificateFiles(studentId: number) {
    return db
      .select({
        fileId: certificateFiles.fileId,
        originalName: certificateFiles.originalName,
        mimeType: certificateFiles.mimeType,
        sizeBytes: certificateFiles.sizeBytes
      })
      .from(certificateFiles)
      .where(eq(certificateFiles.studentId, studentId));
  }
};

const teacherStudentDetailService = createTeacherStudentDetailService({
  teacherStudentDetailRepo
});

const teacherActivityExecutionRepo = {
  async isTeacherAssigned(teacherId: string, activityId: number) {
    const rows = await db
      .select({ id: teacherActivityAssignments.id })
      .from(teacherActivityAssignments)
      .where(
        and(
          eq(teacherActivityAssignments.teacherId, teacherId),
          eq(teacherActivityAssignments.activityId, activityId)
        )
      )
      .limit(1);
    return rows.length > 0;
  },
  async upsertExecutionRecord({ teacherId, activityId, payloadJson, updatedAt }: {
    teacherId: string;
    activityId: number;
    payloadJson: string;
    updatedAt: Date;
  }) {
    const existing = await db
      .select({ id: activityExecutionRecords.id })
      .from(activityExecutionRecords)
      .where(
        and(eq(activityExecutionRecords.teacherId, teacherId), eq(activityExecutionRecords.activityId, activityId))
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(activityExecutionRecords)
        .set({
          payloadJson,
          updatedAt
        })
        .where(eq(activityExecutionRecords.id, existing[0].id));
      return existing[0].id;
    }

    const inserted = await db.insert(activityExecutionRecords).values({
      teacherId,
      activityId,
      payloadJson,
      updatedAt
    });
    return Number(inserted[0].insertId);
  }
};

const teacherActivityExecutionService = createTeacherActivityExecutionService({
  teacherActivityExecutionRepo
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
  async assignStudentGrant(
    teacherId: string,
    studentId: number,
    accessLevel: "read" | "manage"
  ): Promise<void> {
    await db.insert(teacherStudentGrants).values({
      teacherId,
      studentId,
      accessLevel
    }).onDuplicateKeyUpdate({
      set: {
        accessLevel
      }
    });
  },
  async revokeStudentGrant(teacherId: string, studentId: number): Promise<void> {
    await db
      .delete(teacherStudentGrants)
      .where(and(eq(teacherStudentGrants.teacherId, teacherId), eq(teacherStudentGrants.studentId, studentId)));
  },
  async assignClassGrant(
    teacherId: string,
    classId: number,
    accessLevel: "read" | "manage"
  ): Promise<void> {
    await db.insert(teacherClassGrants).values({
      teacherId,
      classId,
      accessLevel
    }).onDuplicateKeyUpdate({
      set: {
        accessLevel
      }
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
    title,
    scopeType,
    scopeTargetId,
    ownerTeacherId,
    startAt,
    endAt,
    timelineNodes,
    status
  }: {
    activityType: "course" | "competition" | "project";
    title: string;
    scopeType: "school" | "college" | "class";
    scopeTargetId: number;
    ownerTeacherId: string;
    startAt: Date;
    endAt: Date;
    timelineNodes: Array<{ key: string; at: string }>;
    status: "draft" | "published" | "closed";
  }): Promise<{ activityId: number }> {
    const inserted = await db.insert(activities).values({
      activityType,
      title,
      scopeType,
      scopeTargetId,
      ownerTeacherId,
      startAt,
      endAt,
      timelineJson: JSON.stringify(timelineNodes),
      status
    });

    const activityId = Number(inserted[0].insertId);
    await db.insert(teacherActivityAssignments).values({
      activityId,
      teacherId: ownerTeacherId
    }).onDuplicateKeyUpdate({
      set: { teacherId: ownerTeacherId }
    });
    return { activityId };
  },
  async listActivities() {
    const rows = await db
      .select({
        activityId: activities.id,
        activityType: activities.activityType,
        title: activities.title,
        scopeType: activities.scopeType,
        scopeTargetId: activities.scopeTargetId,
        ownerTeacherId: activities.ownerTeacherId,
        startAt: activities.startAt,
        endAt: activities.endAt,
        status: activities.status,
        timelineJson: activities.timelineJson
      })
      .from(activities);

    return rows.map((row) => ({
      activityId: row.activityId,
      activityType: row.activityType,
      title: row.title,
      scopeType: row.scopeType,
      scopeTargetId: row.scopeTargetId,
      ownerTeacherId: row.ownerTeacherId,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status,
      timelineNodes: JSON.parse(row.timelineJson) as Array<{ key: string; at: string }>
    }));
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

const adminOrgService = {
  async createCollege({ schoolId, name }: { schoolId: number; name: string }) {
    const inserted = await db
      .insert(colleges)
      .values({
        schoolId,
        name
      });
    return { collegeId: Number(inserted[0].insertId) };
  },
  async updateCollege({ collegeId, name }: { collegeId: number; name: string }) {
    await db
      .update(colleges)
      .set({ name })
      .where(eq(colleges.id, collegeId));
  },
  async deleteCollege({ collegeId }: { collegeId: number }) {
    await db.delete(colleges).where(eq(colleges.id, collegeId));
  }
};

const teacherAccountService = {
  async createTeacherAccount({ name, account, password, status }: {
    name: string;
    account: string;
    password: string;
    status: "active" | "frozen";
  }) {
    const teacherId = `T-${Date.now()}`;
    const passwordHash = await bcryptPasswordHasher.hash(password);
    await db.insert(teachers).values({
      teacherId,
      name,
      account,
      passwordHash,
      status
    });
    return { teacherId };
  },
  async updateTeacherStatus({ teacherId, status }: { teacherId: string; status: "active" | "frozen" }) {
    await db
      .update(teachers)
      .set({ status })
      .where(eq(teachers.teacherId, teacherId));
  },
  async resetTeacherPassword({ teacherId, newPassword }: { teacherId: string; newPassword: string }) {
    const passwordHash = await bcryptPasswordHasher.hash(newPassword);
    await db
      .update(teachers)
      .set({ passwordHash })
      .where(eq(teachers.teacherId, teacherId));
  }
};

const adminStudentArchiveService = {
  async createStudentArchive({ classId, studentNo, name }: { classId: number; studentNo: string; name: string }) {
    const inserted = await db
      .insert(students)
      .values({
        classId,
        studentNo,
        name,
        mustChangePassword: true
      });
    return { studentId: Number(inserted[0].insertId) };
  },
  async getStudentArchive({ studentId }: { studentId: number }) {
    const rows = await db
      .select({
        studentId: students.id,
        studentNo: students.studentNo,
        name: students.name,
        classId: students.classId
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    return rows[0] ?? null;
  },
  async updateStudentArchive({ studentId, name, classId }: { studentId: number; name?: string; classId?: number }) {
    const patch: { name?: string; classId?: number } = {};
    if (name) {
      patch.name = name;
    }
    if (classId) {
      patch.classId = classId;
    }
    if (Object.keys(patch).length === 0) {
      return;
    }
    await db
      .update(students)
      .set(patch)
      .where(eq(students.id, studentId));
  },
  async deleteStudentArchive({ studentId }: { studentId: number }) {
    await db.delete(students).where(eq(students.id, studentId));
  },
  async getEnrollmentLinkStatus({ studentId }: { studentId: number }) {
    const studentRows = await db
      .select({
        studentNo: students.studentNo
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    const studentNo = studentRows[0]?.studentNo;
    if (!studentNo) {
      return { status: "missing" as const, reason: "student not found" };
    }

    if (!/^S\d{6,}$/.test(studentNo)) {
      return { status: "abnormal" as const, reason: "abnormal student_no format" };
    }

    const linkedRows = await db
      .select({
        id: enrollmentProfiles.id
      })
      .from(enrollmentProfiles)
      .where(eq(enrollmentProfiles.studentNo, studentNo));

    if (linkedRows.length === 0) {
      return { status: "missing" as const, reason: "missing in enrollment source" };
    }
    if (linkedRows.length > 1) {
      return { status: "duplicate" as const, reason: "duplicate student_no in enrollment source" };
    }
    return { status: "linked" as const, reason: null };
  }
};

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
    adminOrgService,
    teacherAccountService,
    adminStudentArchiveService,
    adminApiKey: env.ADMIN_API_KEY
  })
);
app.route("/resources", createResourcesRoutes({ createResourceAuthorization }));
app.route(
  "/teacher",
  createTeacherRoutes({
    teacherMyStudentsService,
    teacherStudentDetailService,
    teacherActivityExecutionService
  })
);
app.route(
  "/student",
  createStudentRoutes({
    requireStudentAuth,
    certificateUploadService,
    likertAssessmentService,
    likertAssessmentResultService,
    roleModelMatchingService,
    reportGenerationService,
    reportJobSyncService,
    taskCheckInService
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

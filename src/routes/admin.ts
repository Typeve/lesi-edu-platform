import { Hono } from "hono";
import type { ActivityService, ActivityType } from "../modules/activity/service.js";
import type { AuditLogService } from "../modules/audit/service.js";
import type { AuthorizationGrantService, GrantType } from "../modules/authorization/grant-service.js";
import {
  type DashboardDimension,
  type DashboardDimensionAggregationService,
  type DashboardFilters
} from "../modules/metrics/aggregation.js";
import {
  InvalidDashboardDateRangeError,
  type DashboardTrendFunnelService
} from "../modules/metrics/trend-funnel.js";
import {
  MissingImportFileError,
  UnsupportedExcelFileTypeError,
  type ExcelImportValidationService,
  type ImportDatasetType,
  type UploadedExcelFile
} from "../modules/import/excel-validation.js";
import {
  InvalidNewPasswordError,
  StudentNotFoundError,
  type StudentAuthService
} from "../modules/auth/service.js";

interface AdminResetPasswordRequestBody {
  newPassword: string;
}

interface AdminGrantRequestBody {
  grantType: GrantType;
  teacherId: string;
  targetId: number;
}

interface AdminPublishActivityRequestBody {
  activityType: ActivityType;
  title: string;
}

interface AdminCollegeCreateBody {
  schoolId: number;
  name: string;
}

interface AdminCollegeUpdateBody {
  name: string;
}

interface AdminTeacherCreateBody {
  name: string;
  account: string;
  password: string;
  status: "active" | "frozen";
}

interface AdminTeacherStatusBody {
  status: "active" | "frozen";
}

interface AdminStudentArchiveCreateBody {
  classId: number;
  studentNo: string;
  name: string;
}

export interface AdminRouteDependencies {
  studentAuthService: Pick<StudentAuthService, "resetStudentPasswordByAdmin">;
  authorizationGrantService: Pick<AuthorizationGrantService, "assignGrant" | "revokeGrant">;
  activityService: Pick<ActivityService, "publishActivity">;
  auditLogService: Pick<
    AuditLogService,
    "logAuthorizationGrant" | "logAuthorizationRevoke" | "logPasswordReset" | "logActivityPublish"
  >;
  excelImportValidationService?: Pick<ExcelImportValidationService, "validateExcelImport">;
  dashboardDimensionAggregationService?: Pick<
    DashboardDimensionAggregationService,
    "aggregateByDimension"
  >;
  dashboardTrendFunnelService?: Pick<DashboardTrendFunnelService, "getTrendAndFunnel">;
  adminOrgService?: {
    createCollege(input: { schoolId: number; name: string }): Promise<{ collegeId: number }>;
    updateCollege(input: { collegeId: number; name: string }): Promise<void>;
    deleteCollege(input: { collegeId: number }): Promise<void>;
  };
  teacherAccountService?: {
    createTeacherAccount(input: {
      name: string;
      account: string;
      password: string;
      status: "active" | "frozen";
    }): Promise<{ teacherId: string }>;
    updateTeacherStatus(input: { teacherId: string; status: "active" | "frozen" }): Promise<void>;
    resetTeacherPassword(input: { teacherId: string; newPassword: string }): Promise<void>;
  };
  adminStudentArchiveService?: {
    createStudentArchive(input: { classId: number; studentNo: string; name: string }): Promise<{ studentId: number }>;
    getStudentArchive(input: { studentId: number }): Promise<{
      studentId: number;
      studentNo: string;
      name: string;
      classId: number;
    } | null>;
    updateStudentArchive(input: { studentId: number; name?: string; classId?: number }): Promise<void>;
    deleteStudentArchive(input: { studentId: number }): Promise<void>;
    getEnrollmentLinkStatus(input: { studentId: number }): Promise<{
      status: "linked" | "missing" | "duplicate" | "abnormal";
      reason: string | null;
    }>;
  };
  adminApiKey: string;
}

const isValidResetPasswordBody = (body: unknown): body is AdminResetPasswordRequestBody => {
  if (!body || typeof body !== "object") {
    return false;
  }

  const newPassword = (body as { newPassword?: unknown }).newPassword;

  return typeof newPassword === "string";
};

const isValidGrantType = (grantType: unknown): grantType is GrantType => {
  return grantType === "student" || grantType === "class";
};

const parsePositiveInteger = (rawId: string): number | null => {
  if (!/^[1-9]\d*$/.test(rawId)) {
    return null;
  }

  const parsed = Number.parseInt(rawId, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseTargetId = (rawTargetId: unknown): number | null => {
  if (typeof rawTargetId !== "number" || !Number.isInteger(rawTargetId) || rawTargetId <= 0) {
    return null;
  }

  return rawTargetId;
};

const isValidGrantBody = (body: unknown): body is AdminGrantRequestBody => {
  if (!body || typeof body !== "object") {
    return false;
  }

  const grantType = (body as { grantType?: unknown }).grantType;
  const teacherId = (body as { teacherId?: unknown }).teacherId;
  const targetId = parseTargetId((body as { targetId?: unknown }).targetId);

  return isValidGrantType(grantType) && typeof teacherId === "string" && teacherId.trim().length > 0 && !!targetId;
};

const isValidActivityType = (activityType: unknown): activityType is ActivityType => {
  return activityType === "course" || activityType === "competition" || activityType === "project";
};

const isValidPublishActivityBody = (body: unknown): body is AdminPublishActivityRequestBody => {
  if (!body || typeof body !== "object") {
    return false;
  }

  const activityType = (body as { activityType?: unknown }).activityType;
  const title = (body as { title?: unknown }).title;

  return isValidActivityType(activityType) && typeof title === "string" && title.trim().length > 0;
};

const isForbiddenByAdminKey = (requestAdminKey: string | undefined, adminApiKey: string): boolean => {
  return !requestAdminKey || requestAdminKey !== adminApiKey;
};

const isDashboardDimension = (dimension: unknown): dimension is DashboardDimension => {
  return dimension === "college" || dimension === "major" || dimension === "class";
};

const parsePositiveIntegerQuery = (raw: string | undefined): number | undefined | null => {
  if (raw === undefined) {
    return undefined;
  }

  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const DASHBOARD_DATE_QUERY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isValidDateOnly = (rawDate: string): boolean => {
  const matched = DASHBOARD_DATE_QUERY_PATTERN.exec(rawDate);
  if (!matched) {
    return false;
  }

  const year = Number.parseInt(matched[1], 10);
  const month = Number.parseInt(matched[2], 10);
  const day = Number.parseInt(matched[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const isImportDatasetType = (datasetType: unknown): datasetType is ImportDatasetType => {
  return datasetType === "enrollment" || datasetType === "employment";
};

const resolveDatasetType = (rawDatasetType: unknown): ImportDatasetType | null => {
  if (typeof rawDatasetType !== "string") {
    return null;
  }

  const datasetType = rawDatasetType.trim();
  return isImportDatasetType(datasetType) ? datasetType : null;
};

const isUploadedExcelFile = (value: unknown): value is UploadedExcelFile => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    name?: unknown;
    type?: unknown;
    size?: unknown;
    arrayBuffer?: unknown;
  };

  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
};

const resolveImportFile = (body: Record<string, unknown>): UploadedExcelFile | null => {
  const fileField = body.file;
  if (Array.isArray(fileField)) {
    return null;
  }

  return isUploadedExcelFile(fileField) ? fileField : null;
};

const resolveOperator = (rawOperator: string | undefined): string => {
  if (!rawOperator) {
    return "system-admin";
  }

  const operator = rawOperator.trim();
  return operator.length > 0 ? operator : "system-admin";
};

const defaultExcelImportValidationService: Pick<ExcelImportValidationService, "validateExcelImport"> = {
  async validateExcelImport() {
    throw new Error("excelImportValidationService is not configured");
  }
};

const defaultDashboardDimensionAggregationService: Pick<
  DashboardDimensionAggregationService,
  "aggregateByDimension"
> = {
  async aggregateByDimension() {
    throw new Error("dashboardDimensionAggregationService is not configured");
  }
};

const defaultDashboardTrendFunnelService: Pick<DashboardTrendFunnelService, "getTrendAndFunnel"> = {
  async getTrendAndFunnel() {
    throw new Error("dashboardTrendFunnelService is not configured");
  }
};

const defaultAdminOrgService: NonNullable<AdminRouteDependencies["adminOrgService"]> = {
  async createCollege() {
    throw new Error("adminOrgService is not configured");
  },
  async updateCollege() {
    throw new Error("adminOrgService is not configured");
  },
  async deleteCollege() {
    throw new Error("adminOrgService is not configured");
  }
};

const defaultTeacherAccountService: NonNullable<AdminRouteDependencies["teacherAccountService"]> = {
  async createTeacherAccount() {
    throw new Error("teacherAccountService is not configured");
  },
  async updateTeacherStatus() {
    throw new Error("teacherAccountService is not configured");
  },
  async resetTeacherPassword() {
    throw new Error("teacherAccountService is not configured");
  }
};

const defaultAdminStudentArchiveService: NonNullable<AdminRouteDependencies["adminStudentArchiveService"]> = {
  async createStudentArchive() {
    throw new Error("adminStudentArchiveService is not configured");
  },
  async getStudentArchive() {
    throw new Error("adminStudentArchiveService is not configured");
  },
  async updateStudentArchive() {
    throw new Error("adminStudentArchiveService is not configured");
  },
  async deleteStudentArchive() {
    throw new Error("adminStudentArchiveService is not configured");
  },
  async getEnrollmentLinkStatus() {
    throw new Error("adminStudentArchiveService is not configured");
  }
};

export const createAdminRoutes = ({
  studentAuthService,
  authorizationGrantService,
  activityService,
  auditLogService,
  excelImportValidationService = defaultExcelImportValidationService,
  dashboardDimensionAggregationService = defaultDashboardDimensionAggregationService,
  dashboardTrendFunnelService = defaultDashboardTrendFunnelService,
  adminOrgService = defaultAdminOrgService,
  teacherAccountService = defaultTeacherAccountService,
  adminStudentArchiveService = defaultAdminStudentArchiveService,
  adminApiKey
}: AdminRouteDependencies) => {
  const admin = new Hono();

  admin.post("/students/:id/reset-password", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    const operator = resolveOperator(c.req.header("x-admin-operator-id"));
    const studentId = parsePositiveInteger(c.req.param("id"));

    if (!studentId) {
      return c.json({ message: "invalid student id" }, 400);
    }

    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    if (!isValidResetPasswordBody(body)) {
      return c.json({ message: "newPassword is required" }, 400);
    }

    try {
      await studentAuthService.resetStudentPasswordByAdmin({
        studentId,
        newPassword: body.newPassword
      });

      await auditLogService.logPasswordReset({
        operator,
        studentId
      });

      return c.json({ message: "password reset" }, 200);
    } catch (error) {
      if (error instanceof InvalidNewPasswordError) {
        return c.json({ message: error.message }, 400);
      }

      if (error instanceof StudentNotFoundError) {
        return c.json({ message: "student not found" }, 404);
      }

      throw error;
    }
  });

  admin.post("/org/colleges", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    const body = (await c.req.json().catch(() => null)) as AdminCollegeCreateBody | null;
    if (!body || !Number.isInteger(body.schoolId) || body.schoolId <= 0 || !body.name?.trim()) {
      return c.json({ message: "invalid request body" }, 400);
    }

    const result = await adminOrgService.createCollege({
      schoolId: body.schoolId,
      name: body.name.trim()
    });
    return c.json(result, 200);
  });

  admin.patch("/org/colleges/:id", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    const collegeId = parsePositiveInteger(c.req.param("id"));
    const body = (await c.req.json().catch(() => null)) as AdminCollegeUpdateBody | null;
    if (!collegeId || !body?.name?.trim()) {
      return c.json({ message: "invalid request body" }, 400);
    }

    await adminOrgService.updateCollege({ collegeId, name: body.name.trim() });
    return c.json({ message: "ok" }, 200);
  });

  admin.delete("/org/colleges/:id", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }
    const collegeId = parsePositiveInteger(c.req.param("id"));
    if (!collegeId) {
      return c.json({ message: "invalid college id" }, 400);
    }

    await adminOrgService.deleteCollege({ collegeId });
    return c.json({ message: "ok" }, 200);
  });

  admin.post("/teachers", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    const body = (await c.req.json().catch(() => null)) as AdminTeacherCreateBody | null;
    if (
      !body ||
      !body.name?.trim() ||
      !body.account?.trim() ||
      !body.password ||
      (body.status !== "active" && body.status !== "frozen")
    ) {
      return c.json({ message: "invalid request body" }, 400);
    }

    const result = await teacherAccountService.createTeacherAccount({
      name: body.name.trim(),
      account: body.account.trim(),
      password: body.password,
      status: body.status
    });
    await auditLogService.logActivityPublish({
      operator: resolveOperator(c.req.header("x-admin-operator-id")),
      activityType: "course",
      title: `teacher_create:${result.teacherId}`
    });
    return c.json(result, 200);
  });

  admin.patch("/teachers/:id/status", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }
    const teacherId = c.req.param("id");
    const body = (await c.req.json().catch(() => null)) as AdminTeacherStatusBody | null;
    if (!teacherId?.trim() || !body || (body.status !== "active" && body.status !== "frozen")) {
      return c.json({ message: "invalid request body" }, 400);
    }

    await teacherAccountService.updateTeacherStatus({
      teacherId: teacherId.trim(),
      status: body.status
    });
    await auditLogService.logActivityPublish({
      operator: resolveOperator(c.req.header("x-admin-operator-id")),
      activityType: "course",
      title: `teacher_status:${teacherId}:${body.status}`
    });
    return c.json({ message: "ok" }, 200);
  });

  admin.post("/teachers/:id/reset-password", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }
    const teacherId = c.req.param("id")?.trim();
    const body = (await c.req.json().catch(() => null)) as { newPassword?: string } | null;
    if (!teacherId || !body?.newPassword || body.newPassword.length < 8) {
      return c.json({ message: "invalid request body" }, 400);
    }

    await teacherAccountService.resetTeacherPassword({
      teacherId,
      newPassword: body.newPassword
    });
    await auditLogService.logPasswordReset({
      operator: resolveOperator(c.req.header("x-admin-operator-id")),
      targetStudentId: 0
    });
    return c.json({ message: "ok" }, 200);
  });

  admin.post("/students", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }
    const body = (await c.req.json().catch(() => null)) as AdminStudentArchiveCreateBody | null;
    if (
      !body ||
      !Number.isInteger(body.classId) ||
      body.classId <= 0 ||
      !body.studentNo?.trim() ||
      !body.name?.trim()
    ) {
      return c.json({ message: "invalid request body" }, 400);
    }

    const result = await adminStudentArchiveService.createStudentArchive({
      classId: body.classId,
      studentNo: body.studentNo.trim(),
      name: body.name.trim()
    });
    return c.json(result, 200);
  });

  admin.get("/students/:id", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }
    const studentId = parsePositiveInteger(c.req.param("id"));
    if (!studentId) {
      return c.json({ message: "invalid student id" }, 400);
    }
    const result = await adminStudentArchiveService.getStudentArchive({ studentId });
    if (!result) {
      return c.json({ message: "student not found" }, 404);
    }
    return c.json(result, 200);
  });

  admin.patch("/students/:id", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }
    const studentId = parsePositiveInteger(c.req.param("id"));
    if (!studentId) {
      return c.json({ message: "invalid student id" }, 400);
    }
    const body = (await c.req.json().catch(() => null)) as { name?: string; classId?: number } | null;
    if (!body) {
      return c.json({ message: "invalid request body" }, 400);
    }
    await adminStudentArchiveService.updateStudentArchive({
      studentId,
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      classId: Number.isInteger(body.classId) && body.classId > 0 ? body.classId : undefined
    });
    return c.json({ message: "ok" }, 200);
  });

  admin.delete("/students/:id", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }
    const studentId = parsePositiveInteger(c.req.param("id"));
    if (!studentId) {
      return c.json({ message: "invalid student id" }, 400);
    }
    await adminStudentArchiveService.deleteStudentArchive({ studentId });
    return c.json({ message: "ok" }, 200);
  });

  admin.get("/students/:id/enrollment-link", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }
    const studentId = parsePositiveInteger(c.req.param("id"));
    if (!studentId) {
      return c.json({ message: "invalid student id" }, 400);
    }
    const result = await adminStudentArchiveService.getEnrollmentLinkStatus({ studentId });
    return c.json(result, 200);
  });

  admin.post("/authorizations/grants", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    const operator = resolveOperator(c.req.header("x-admin-operator-id"));

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    if (!isValidGrantBody(body)) {
      return c.json({ message: "grantType/teacherId/targetId is required" }, 400);
    }

    await authorizationGrantService.assignGrant({
      grantType: body.grantType,
      teacherId: body.teacherId.trim(),
      targetId: body.targetId
    });

    await auditLogService.logAuthorizationGrant({
      operator,
      teacherId: body.teacherId.trim(),
      grantType: body.grantType,
      targetId: body.targetId
    });

    return c.json({ message: "authorization granted" }, 200);
  });

  admin.delete("/authorizations/grants", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    const operator = resolveOperator(c.req.header("x-admin-operator-id"));

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    if (!isValidGrantBody(body)) {
      return c.json({ message: "grantType/teacherId/targetId is required" }, 400);
    }

    await authorizationGrantService.revokeGrant({
      grantType: body.grantType,
      teacherId: body.teacherId.trim(),
      targetId: body.targetId
    });

    await auditLogService.logAuthorizationRevoke({
      operator,
      teacherId: body.teacherId.trim(),
      grantType: body.grantType,
      targetId: body.targetId
    });

    return c.json({ message: "authorization revoked" }, 200);
  });

  admin.post("/activities", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    const operator = resolveOperator(c.req.header("x-admin-operator-id"));

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    if (!isValidPublishActivityBody(body)) {
      return c.json({ message: "activityType/title is required" }, 400);
    }

    await activityService.publishActivity({
      activityType: body.activityType,
      title: body.title.trim()
    });

    await auditLogService.logActivityPublish({
      operator,
      activityType: body.activityType,
      activityTitle: body.title.trim()
    });

    return c.json({ message: "activity published" }, 201);
  });

  admin.post("/imports/excel/validate", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody({ all: true });
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    const datasetType = resolveDatasetType(body.datasetType);
    if (!datasetType) {
      return c.json({ message: "datasetType must be enrollment or employment" }, 400);
    }

    const file = resolveImportFile(body);

    try {
      const result = await excelImportValidationService.validateExcelImport({
        datasetType,
        file
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof MissingImportFileError) {
        return c.json({ message: "file is required" }, 400);
      }

      if (error instanceof UnsupportedExcelFileTypeError) {
        return c.json({ message: "unsupported file type" }, 415);
      }

      throw error;
    }
  });

  admin.get("/dashboard/dimension-aggregation", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    const dimensionQuery = c.req.query("dimension");
    if (!isDashboardDimension(dimensionQuery)) {
      return c.json({ message: "dimension must be college/major/class" }, 400);
    }

    const schoolId = parsePositiveIntegerQuery(c.req.query("schoolId"));
    const collegeId = parsePositiveIntegerQuery(c.req.query("collegeId"));
    const majorId = parsePositiveIntegerQuery(c.req.query("majorId"));
    const classId = parsePositiveIntegerQuery(c.req.query("classId"));

    if ([schoolId, collegeId, majorId, classId].some((value) => value === null)) {
      return c.json({ message: "organization filter must be positive integer" }, 400);
    }

    const filters: DashboardFilters = {
      schoolId: schoolId as number | undefined,
      collegeId: collegeId as number | undefined,
      majorId: majorId as number | undefined,
      classId: classId as number | undefined
    };

    const result = await dashboardDimensionAggregationService.aggregateByDimension({
      dimension: dimensionQuery,
      filters
    });

    return c.json(result, 200);
  });

  admin.get("/dashboard/trend-funnel", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (isForbiddenByAdminKey(requestAdminKey, adminApiKey)) {
      return c.json({ message: "forbidden" }, 403);
    }

    const schoolId = parsePositiveIntegerQuery(c.req.query("schoolId"));
    const collegeId = parsePositiveIntegerQuery(c.req.query("collegeId"));
    const majorId = parsePositiveIntegerQuery(c.req.query("majorId"));
    const classId = parsePositiveIntegerQuery(c.req.query("classId"));

    if ([schoolId, collegeId, majorId, classId].some((value) => value === null)) {
      return c.json({ message: "organization filter must be positive integer" }, 400);
    }

    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    if ((startDate && !isValidDateOnly(startDate)) || (endDate && !isValidDateOnly(endDate))) {
      return c.json({ message: "startDate/endDate must be YYYY-MM-DD" }, 400);
    }

    if (startDate && endDate && startDate > endDate) {
      return c.json({ message: "startDate must be less than or equal to endDate" }, 400);
    }

    const filters: DashboardFilters = {
      schoolId: schoolId as number | undefined,
      collegeId: collegeId as number | undefined,
      majorId: majorId as number | undefined,
      classId: classId as number | undefined
    };

    try {
      const result = await dashboardTrendFunnelService.getTrendAndFunnel({
        filters,
        startDate,
        endDate
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof InvalidDashboardDateRangeError) {
        return c.json({ message: error.message }, 400);
      }

      throw error;
    }
  });

  return admin;
};

export default createAdminRoutes;

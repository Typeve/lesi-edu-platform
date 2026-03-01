import { Hono } from "hono";
import type { ActivityService, ActivityType } from "../modules/activity/service.js";
import type { AuditLogService } from "../modules/audit/service.js";
import type { AuthorizationGrantService, GrantType } from "../modules/authorization/grant-service.js";
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

export interface AdminRouteDependencies {
  studentAuthService: Pick<StudentAuthService, "resetStudentPasswordByAdmin">;
  authorizationGrantService: Pick<AuthorizationGrantService, "assignGrant" | "revokeGrant">;
  activityService: Pick<ActivityService, "publishActivity">;
  auditLogService: Pick<
    AuditLogService,
    "logAuthorizationGrant" | "logAuthorizationRevoke" | "logPasswordReset" | "logActivityPublish"
  >;
  excelImportValidationService?: Pick<ExcelImportValidationService, "validateExcelImport">;
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

export const createAdminRoutes = ({
  studentAuthService,
  authorizationGrantService,
  activityService,
  auditLogService,
  excelImportValidationService = defaultExcelImportValidationService,
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

  return admin;
};

export default createAdminRoutes;

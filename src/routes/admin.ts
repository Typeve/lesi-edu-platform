import { Hono } from "hono";
import type { ActivityService, ActivityType } from "../modules/activity/service.js";
import type { AuditLogService } from "../modules/audit/service.js";
import type { AuthorizationGrantService, GrantType } from "../modules/authorization/grant-service.js";
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

const resolveOperator = (rawOperator: string | undefined): string => {
  if (!rawOperator) {
    return "system-admin";
  }

  const operator = rawOperator.trim();
  return operator.length > 0 ? operator : "system-admin";
};

export const createAdminRoutes = ({
  studentAuthService,
  authorizationGrantService,
  activityService,
  auditLogService,
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

  return admin;
};

export default createAdminRoutes;

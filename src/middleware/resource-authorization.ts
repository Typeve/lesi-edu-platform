import type { MiddlewareHandler } from "hono";
import type {
  ResourceAuthorizationService,
  ResourceType
} from "../modules/authorization/service.js";

export interface AuthorizedResourceContext {
  teacherId: string;
  studentId: number;
  resourceType: ResourceType;
  resourceId: number;
}

declare module "hono" {
  interface ContextVariableMap {
    resourceAuth: AuthorizedResourceContext;
  }
}

export interface CreateResourceAuthorizationMiddlewareInput {
  resourceType: ResourceType;
  authorizationService: ResourceAuthorizationService;
}

const parseTeacherId = (rawTeacherId: string | undefined): string | null => {
  if (!rawTeacherId) {
    return null;
  }

  const teacherId = rawTeacherId.trim();
  return teacherId.length > 0 ? teacherId : null;
};

const parseResourceId = (rawResourceId: string | undefined): number | null => {
  if (!rawResourceId) {
    return null;
  }

  const parsed = Number(rawResourceId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export const createResourceAuthorizationMiddleware = ({
  resourceType,
  authorizationService
}: CreateResourceAuthorizationMiddlewareInput): MiddlewareHandler => {
  return async (c, next) => {
    const teacherId = parseTeacherId(c.req.header("x-teacher-id"));

    if (!teacherId) {
      return c.json({ message: "unauthorized" }, 401);
    }

    const resourceId = parseResourceId(c.req.param("id"));
    if (!resourceId) {
      return c.json({ message: "invalid resource id" }, 400);
    }

    const decision = await authorizationService.authorizeTeacherResource({
      teacherId,
      resourceType,
      resourceId
    });

    if (decision.status === "not_found") {
      return c.json({ message: "resource not found" }, 404);
    }

    if (decision.status === "forbidden") {
      return c.json({ message: "forbidden" }, 403);
    }

    c.set("resourceAuth", {
      teacherId,
      studentId: decision.studentId,
      resourceType,
      resourceId
    });

    await next();
  };
};

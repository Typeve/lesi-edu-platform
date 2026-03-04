import type { MiddlewareHandler } from "hono";
import type { AuthTokenPayload } from "../modules/auth/session-token.js";
import type {
  ResourceAuthorizationService,
  ResourceType
} from "../modules/authorization/service.js";

export interface AuthorizedResourceContext {
  role: AuthTokenPayload["role"];
  teacherId?: string;
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
  hasPermission: (input: { auth: AuthTokenPayload; permission: string }) => boolean;
}

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

const resolveResourcePermission = (resourceType: ResourceType): string => {
  switch (resourceType) {
    case "report":
      return "report.read";
    case "task":
      return "task.read";
    case "certificate":
      return "task.read";
    case "profile":
      return "student.profile.read";
    default:
      return "report.read";
  }
};

export const createResourceAuthorizationMiddleware = ({
  resourceType,
  authorizationService,
  hasPermission
}: CreateResourceAuthorizationMiddlewareInput): MiddlewareHandler => {
  return async (c, next) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ message: "unauthorized" }, 401);
    }

    const resourceId = parseResourceId(c.req.param("id"));
    if (!resourceId) {
      return c.json({ message: "invalid resource id" }, 400);
    }

    if (!hasPermission({ auth, permission: resolveResourcePermission(resourceType) })) {
      return c.json({ message: "forbidden" }, 403);
    }

    const studentId = await authorizationService.findResourceStudentId({
      resourceType,
      resourceId
    });

    if (!studentId) {
      return c.json({ message: "resource not found" }, 404);
    }

    if (auth.role === "student") {
      if (!auth.studentId || auth.studentId !== studentId) {
        return c.json({ message: "forbidden" }, 403);
      }

      c.set("resourceAuth", {
        role: auth.role,
        studentId,
        resourceType,
        resourceId
      });
      await next();
      return;
    }

    if (auth.role === "teacher") {
      if (!auth.teacherId) {
        return c.json({ message: "forbidden" }, 403);
      }

      const decision = await authorizationService.authorizeTeacherResource({
        teacherId: auth.teacherId,
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
        role: auth.role,
        teacherId: auth.teacherId,
        studentId: decision.studentId,
        resourceType,
        resourceId
      });
      await next();
      return;
    }

    c.set("resourceAuth", {
      role: auth.role,
      studentId,
      resourceType,
      resourceId
    });

    await next();
  };
};

import { Hono, type MiddlewareHandler } from "hono";
import {
  StudentChangePasswordUnauthorizedError,
  StudentLoginUnauthorizedError,
  type StudentAuthService
} from "../modules/auth/service.js";

interface StudentLoginRequestBody {
  studentNo: string;
  password: string;
}

interface StudentChangePasswordRequestBody {
  oldPassword: string;
  newPassword: string;
}

export interface AuthRouteDependencies {
  studentAuthService: StudentAuthService;
  requireStudentAuth?: MiddlewareHandler;
}

const passThroughAuthMiddleware: MiddlewareHandler = async (_, next) => {
  await next();
};

const isValidLoginBody = (body: unknown): body is StudentLoginRequestBody => {
  if (!body || typeof body !== "object") {
    return false;
  }

  const studentNo = (body as { studentNo?: unknown }).studentNo;
  const password = (body as { password?: unknown }).password;

  return (
    typeof studentNo === "string" &&
    studentNo.trim().length > 0 &&
    typeof password === "string" &&
    password.length > 0
  );
};

const isValidChangePasswordBody = (body: unknown): body is StudentChangePasswordRequestBody => {
  if (!body || typeof body !== "object") {
    return false;
  }

  const oldPassword = (body as { oldPassword?: unknown }).oldPassword;
  const newPassword = (body as { newPassword?: unknown }).newPassword;

  return (
    typeof oldPassword === "string" &&
    oldPassword.length > 0 &&
    typeof newPassword === "string" &&
    newPassword.length > 0
  );
};

export const createAuthRoutes = ({
  studentAuthService,
  requireStudentAuth = passThroughAuthMiddleware
}: AuthRouteDependencies) => {
  const auth = new Hono();

  auth.post("/student/login", async (c) => {
    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    if (!isValidLoginBody(body)) {
      return c.json({ message: "studentNo and password are required" }, 400);
    }

    try {
      const result = await studentAuthService.loginStudent({
        studentNo: body.studentNo.trim(),
        password: body.password
      });
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof StudentLoginUnauthorizedError) {
        return c.json({ message: "invalid studentNo or password" }, 401);
      }

      throw error;
    }
  });

  auth.post("/student/change-password", requireStudentAuth, async (c) => {
    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    if (!isValidChangePasswordBody(body)) {
      return c.json({ message: "oldPassword and newPassword are required" }, 400);
    }

    const studentAuth = c.get("studentAuth");
    if (!studentAuth) {
      return c.json({ message: "unauthorized" }, 401);
    }

    try {
      await studentAuthService.changeStudentPassword({
        studentId: studentAuth.studentId,
        oldPassword: body.oldPassword,
        newPassword: body.newPassword
      });

      return c.json({ message: "password changed" }, 200);
    } catch (error) {
      if (error instanceof StudentChangePasswordUnauthorizedError) {
        return c.json({ message: "invalid old password" }, 401);
      }

      throw error;
    }
  });

  return auth;
};

export default createAuthRoutes;

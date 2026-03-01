import { Hono } from "hono";
import {
  InvalidNewPasswordError,
  StudentNotFoundError,
  type StudentAuthService
} from "../modules/auth/service.js";

interface AdminResetPasswordRequestBody {
  newPassword: string;
}

export interface AdminRouteDependencies {
  studentAuthService: Pick<StudentAuthService, "resetStudentPasswordByAdmin">;
  adminApiKey: string;
}

const isValidResetPasswordBody = (body: unknown): body is AdminResetPasswordRequestBody => {
  if (!body || typeof body !== "object") {
    return false;
  }

  const newPassword = (body as { newPassword?: unknown }).newPassword;

  return typeof newPassword === "string";
};

const parseStudentId = (rawId: string): number | null => {
  if (!/^[1-9]\d*$/.test(rawId)) {
    return null;
  }

  const parsed = Number.parseInt(rawId, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export const createAdminRoutes = ({
  studentAuthService,
  adminApiKey
}: AdminRouteDependencies) => {
  const admin = new Hono();

  admin.post("/students/:id/reset-password", async (c) => {
    const requestAdminKey = c.req.header("x-admin-key");
    if (!requestAdminKey || requestAdminKey !== adminApiKey) {
      return c.json({ message: "forbidden" }, 403);
    }

    const studentId = parseStudentId(c.req.param("id"));

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

  return admin;
};

export default createAdminRoutes;

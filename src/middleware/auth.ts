import type { MiddlewareHandler } from "hono";
import type { StudentAuthRepository } from "../modules/auth/service.js";
import type { StudentTokenVerifier } from "../modules/auth/token.js";

export interface AuthenticatedStudentContext {
  studentId: number;
  studentNo: string;
  mustChangePassword: boolean;
}

declare module "hono" {
  interface ContextVariableMap {
    studentAuth: AuthenticatedStudentContext;
  }
}

export interface CreateStudentAuthMiddlewareInput {
  tokenVerifier: StudentTokenVerifier;
  studentRepo: Pick<StudentAuthRepository, "findStudentById">;
  changePasswordPath?: string;
}

const DEFAULT_CHANGE_PASSWORD_PATH = "/auth/student/change-password";

const parseBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

export const createStudentAuthMiddleware = ({
  tokenVerifier,
  studentRepo,
  changePasswordPath = DEFAULT_CHANGE_PASSWORD_PATH
}: CreateStudentAuthMiddlewareInput): MiddlewareHandler => {
  return async (c, next) => {
    const token = parseBearerToken(c.req.header("authorization"));

    if (!token) {
      return c.json({ message: "unauthorized" }, 401);
    }

    const verifiedPayload = tokenVerifier.verifyStudentToken(token);

    if (!verifiedPayload) {
      return c.json({ message: "unauthorized" }, 401);
    }

    const student = await studentRepo.findStudentById(verifiedPayload.studentId);

    if (!student) {
      return c.json({ message: "unauthorized" }, 401);
    }

    c.set("studentAuth", {
      studentId: student.id,
      studentNo: student.studentNo,
      mustChangePassword: student.mustChangePassword
    });

    if (student.mustChangePassword && c.req.path !== changePasswordPath) {
      return c.json({ message: "password change required" }, 403);
    }

    await next();
  };
};

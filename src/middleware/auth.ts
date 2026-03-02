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
  firstLoginVerifyPath?: string;
  enrollmentProfilePath?: string;
}

const DEFAULT_CHANGE_PASSWORD_PATH = "/auth/student/change-password";
const DEFAULT_FIRST_LOGIN_VERIFY_PATH = "/auth/student/first-login-verify";
const DEFAULT_ENROLLMENT_PROFILE_PATH = "/auth/student/enrollment-profile";
const BEARER_TOKEN_PATTERN = /^bearer\s+(\S+)\s*$/i;

const parseBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const matched = authorizationHeader.trim().match(BEARER_TOKEN_PATTERN);

  if (!matched) {
    return null;
  }

  return matched[1];
};

export const createStudentAuthMiddleware = ({
  tokenVerifier,
  studentRepo,
  changePasswordPath = DEFAULT_CHANGE_PASSWORD_PATH,
  firstLoginVerifyPath = DEFAULT_FIRST_LOGIN_VERIFY_PATH,
  enrollmentProfilePath = DEFAULT_ENROLLMENT_PROFILE_PATH
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

    if (
      student.firstLoginVerifiedAt === null &&
      c.req.path !== changePasswordPath &&
      c.req.path !== firstLoginVerifyPath &&
      c.req.path !== enrollmentProfilePath
    ) {
      return c.json({ message: "first login verification required" }, 403);
    }

    await next();
  };
};

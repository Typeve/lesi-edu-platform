import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { students } from "../db/schema.js";
import { bcryptPasswordVerifier, type PasswordVerifier } from "../modules/auth/password.js";
import {
  createStudentAuthService,
  StudentLoginUnauthorizedError,
  type StudentAuthRepository
} from "../modules/auth/service.js";
import { createJwtTokenSigner, type StudentTokenSigner } from "../modules/auth/token.js";

interface StudentLoginRequestBody {
  studentNo: string;
  password: string;
}

export interface AuthRouteDependencies {
  studentRepo: StudentAuthRepository;
  passwordVerifier: PasswordVerifier;
  tokenSigner: StudentTokenSigner;
}

const createDbStudentRepository = (): StudentAuthRepository => {
  return {
    async findStudentByNo(studentNo) {
      const records = await db
        .select({
          id: students.id,
          studentNo: students.studentNo,
          passwordHash: students.passwordHash,
          mustChangePassword: students.mustChangePassword
        })
        .from(students)
        .where(eq(students.studentNo, studentNo))
        .limit(1);

      return records[0] ?? null;
    }
  };
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

export const createAuthRoutes = (deps: Partial<AuthRouteDependencies> = {}) => {
  const studentAuthService = createStudentAuthService({
    studentRepo: deps.studentRepo ?? createDbStudentRepository(),
    passwordVerifier: deps.passwordVerifier ?? bcryptPasswordVerifier,
    tokenSigner:
      deps.tokenSigner ??
      createJwtTokenSigner({
        secret: env.JWT_SECRET,
        expiresInDays: env.JWT_EXPIRES_IN_DAYS
      })
  });

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
      const result = await studentAuthService.loginStudent(body);
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof StudentLoginUnauthorizedError) {
        return c.json({ message: "invalid studentNo or password" }, 401);
      }

      throw error;
    }
  });

  return auth;
};

export default createAuthRoutes;

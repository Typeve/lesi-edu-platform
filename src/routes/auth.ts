import { Hono } from "hono";
import {
  StudentLoginUnauthorizedError,
  type StudentAuthService
} from "../modules/auth/service.js";

interface StudentLoginRequestBody {
  studentNo: string;
  password: string;
}

export interface AuthRouteDependencies {
  studentAuthService: StudentAuthService;
}

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

export const createAuthRoutes = ({ studentAuthService }: AuthRouteDependencies) => {
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

  return auth;
};

export default createAuthRoutes;

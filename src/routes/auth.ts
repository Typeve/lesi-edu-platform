import { Hono, type MiddlewareHandler } from "hono";
import {
  InvalidNewPasswordError,
  StudentChangePasswordUnauthorizedError,
  StudentLoginUnauthorizedError,
  type StudentAuthService
} from "../modules/auth/service.js";
import {
  StudentFirstLoginVerificationMismatchError,
  StudentFirstLoginVerificationNotFoundError,
  type StudentFirstLoginVerificationService
} from "../modules/auth/first-login-verification.js";
import type { EnrollmentProfileService } from "../modules/enrollment/profile.js";

interface StudentLoginRequestBody {
  studentNo: string;
  password: string;
}

interface StudentChangePasswordRequestBody {
  oldPassword: string;
  newPassword: string;
}

interface StudentFirstLoginVerificationRequestBody {
  name: string;
  credentialNo: string;
  schoolName: string;
  majorName: string;
}

export interface AuthRouteDependencies {
  studentAuthService: StudentAuthService;
  studentFirstLoginVerificationService?: Pick<
    StudentFirstLoginVerificationService,
    "verifyStudentFirstLogin"
  >;
  enrollmentProfileService?: Pick<EnrollmentProfileService, "getEnrollmentProfile">;
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

const isValidFirstLoginVerificationBody = (
  body: unknown
): body is StudentFirstLoginVerificationRequestBody => {
  if (!body || typeof body !== "object") {
    return false;
  }

  const name = (body as { name?: unknown }).name;
  const credentialNo = (body as { credentialNo?: unknown }).credentialNo;
  const schoolName = (body as { schoolName?: unknown }).schoolName;
  const majorName = (body as { majorName?: unknown }).majorName;

  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    typeof credentialNo === "string" &&
    credentialNo.trim().length > 0 &&
    typeof schoolName === "string" &&
    schoolName.trim().length > 0 &&
    typeof majorName === "string" &&
    majorName.trim().length > 0
  );
};

const defaultStudentFirstLoginVerificationService: Pick<
  StudentFirstLoginVerificationService,
  "verifyStudentFirstLogin"
> = {
  async verifyStudentFirstLogin() {
    throw new Error("studentFirstLoginVerificationService is not configured");
  }
};

const defaultEnrollmentProfileService: Pick<EnrollmentProfileService, "getEnrollmentProfile"> = {
  async getEnrollmentProfile() {
    throw new Error("enrollmentProfileService is not configured");
  }
};

export const createAuthRoutes = ({
  studentAuthService,
  studentFirstLoginVerificationService = defaultStudentFirstLoginVerificationService,
  enrollmentProfileService = defaultEnrollmentProfileService,
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

      if (error instanceof InvalidNewPasswordError) {
        return c.json({ message: error.message }, 400);
      }

      throw error;
    }
  });

  auth.post("/student/first-login-verify", requireStudentAuth, async (c) => {
    const studentAuth = c.get("studentAuth");
    if (!studentAuth) {
      return c.json({ message: "unauthorized" }, 401);
    }

    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    if (!isValidFirstLoginVerificationBody(body)) {
      return c.json({ message: "name/credentialNo/schoolName/majorName is required" }, 400);
    }

    try {
      const result = await studentFirstLoginVerificationService.verifyStudentFirstLogin({
        studentId: studentAuth.studentId,
        name: body.name.trim(),
        credentialNo: body.credentialNo.trim(),
        schoolName: body.schoolName.trim(),
        majorName: body.majorName.trim()
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof StudentFirstLoginVerificationNotFoundError) {
        return c.json({ message: "student not found" }, 404);
      }

      if (error instanceof StudentFirstLoginVerificationMismatchError) {
        return c.json(
          {
            message: "first login verification failed",
            reasons: error.reasons
          },
          422
        );
      }

      throw error;
    }
  });

  auth.get("/student/enrollment-profile", requireStudentAuth, async (c) => {
    const studentAuth = c.get("studentAuth");

    if (!studentAuth) {
      return c.json({ message: "unauthorized" }, 401);
    }

    const result = await enrollmentProfileService.getEnrollmentProfile({
      studentNo: studentAuth.studentNo
    });

    return c.json(result, 200);
  });

  return auth;
};

export default createAuthRoutes;

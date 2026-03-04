import { Hono, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  InvalidNewPasswordError,
  StudentChangePasswordUnauthorizedError,
  StudentLoginUnauthorizedError,
  type StudentAuthService
} from "../modules/auth/service.js";
import {
  SessionAuthUnauthorizedError,
  type SessionAuthService
} from "../modules/auth/session.js";
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

interface SessionLoginRequestBody {
  account: string;
  password: string;
}

interface StudentFirstLoginVerificationRequestBody {
  name: string;
  credentialNo: string;
  schoolName: string;
  majorName: string;
}

export interface AuthRouteDependencies {
  studentAuthService: StudentAuthService;
  sessionAuthService?: SessionAuthService;
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

const REFRESH_TOKEN_COOKIE_KEY = "refresh_token";
const REFRESH_TOKEN_COOKIE_PATH = "/";
const REFRESH_TOKEN_COOKIE_SAME_SITE = "Lax";

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

const isValidSessionLoginBody = (body: unknown): body is SessionLoginRequestBody => {
  if (!body || typeof body !== "object") {
    return false;
  }

  const account = (body as { account?: unknown }).account;
  const password = (body as { password?: unknown }).password;

  return (
    typeof account === "string" &&
    account.trim().length > 0 &&
    typeof password === "string" &&
    password.length > 0
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

const defaultSessionAuthService: SessionAuthService = {
  async login() {
    throw new Error("sessionAuthService is not configured");
  },
  async refresh() {
    throw new Error("sessionAuthService is not configured");
  },
  async logout() {
    throw new Error("sessionAuthService is not configured");
  },
  async getSessionUser() {
    throw new Error("sessionAuthService is not configured");
  }
};

const getRefreshCookieValue = (c: Parameters<MiddlewareHandler>[0]): string | null => {
  const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE_KEY);
  if (!refreshToken || refreshToken.trim().length === 0) {
    return null;
  }

  return refreshToken;
};

const setRefreshCookie = ({
  c,
  refreshToken,
  maxAge
}: {
  c: Parameters<MiddlewareHandler>[0];
  refreshToken: string;
  maxAge: number;
}): void => {
  setCookie(c, REFRESH_TOKEN_COOKIE_KEY, refreshToken, {
    httpOnly: true,
    sameSite: REFRESH_TOKEN_COOKIE_SAME_SITE,
    path: REFRESH_TOKEN_COOKIE_PATH,
    secure: process.env.NODE_ENV === "production",
    maxAge
  });
};

const clearRefreshCookie = (c: Parameters<MiddlewareHandler>[0]): void => {
  deleteCookie(c, REFRESH_TOKEN_COOKIE_KEY, {
    path: REFRESH_TOKEN_COOKIE_PATH
  });
};

const getBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const matched = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!matched || !matched[1]) {
    return null;
  }

  return matched[1].trim();
};

export const createAuthRoutes = ({
  studentAuthService,
  sessionAuthService = defaultSessionAuthService,
  studentFirstLoginVerificationService = defaultStudentFirstLoginVerificationService,
  enrollmentProfileService = defaultEnrollmentProfileService,
  requireStudentAuth = passThroughAuthMiddleware
}: AuthRouteDependencies) => {
  const auth = new Hono();

  auth.post("/login", async (c) => {
    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    if (!isValidSessionLoginBody(body)) {
      return c.json({ message: "account and password are required" }, 400);
    }

    try {
      const result = await sessionAuthService.login({
        account: body.account.trim(),
        password: body.password
      });
      setRefreshCookie({
        c,
        refreshToken: result.refreshToken,
        maxAge: result.refreshExpiresIn
      });

      return c.json(
        {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: result.user
        },
        200
      );
    } catch (error) {
      if (error instanceof SessionAuthUnauthorizedError) {
        return c.json({ message: "unauthorized" }, 401);
      }

      throw error;
    }
  });

  auth.post("/refresh", async (c) => {
    const refreshToken = getRefreshCookieValue(c);

    if (!refreshToken) {
      return c.json({ message: "unauthorized" }, 401);
    }

    try {
      const result = await sessionAuthService.refresh({
        refreshToken
      });
      setRefreshCookie({
        c,
        refreshToken: result.refreshToken,
        maxAge: result.refreshExpiresIn
      });

      return c.json(
        {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: result.user
        },
        200
      );
    } catch (error) {
      if (error instanceof SessionAuthUnauthorizedError) {
        return c.json({ message: "unauthorized" }, 401);
      }

      throw error;
    }
  });

  auth.post("/logout", async (c) => {
    const refreshToken = getRefreshCookieValue(c);

    if (refreshToken) {
      try {
        await sessionAuthService.logout({ refreshToken });
      } catch (error) {
        if (!(error instanceof SessionAuthUnauthorizedError)) {
          throw error;
        }
      }
    }

    clearRefreshCookie(c);
    return c.json({ message: "logged out" }, 200);
  });

  auth.get("/me", async (c) => {
    const authorization = c.req.header("authorization");
    const accessToken = getBearerToken(authorization);
    if (!accessToken) {
      return c.json({ message: "unauthorized" }, 401);
    }

    try {
      const user = await sessionAuthService.getSessionUser({ accessToken });
      return c.json(user, 200);
    } catch (error) {
      if (error instanceof SessionAuthUnauthorizedError) {
        return c.json({ message: "unauthorized" }, 401);
      }

      throw error;
    }
  });

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

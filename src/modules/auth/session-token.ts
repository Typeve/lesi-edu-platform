import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken") as {
  sign(payload: Record<string, unknown>, secret: string, options: { expiresIn: number }): string;
  verify(token: string, secret: string): string | Record<string, unknown>;
};

const SECONDS_PER_DAY = 24 * 60 * 60;

export type AuthRole = "student" | "teacher" | "admin";

export interface AuthTokenPayload {
  sub: string;
  role: AuthRole;
  account: string;
  displayName?: string;
  studentId?: number;
  studentNo?: string;
  teacherId?: string;
  schoolId?: number;
  collegeId?: number;
  majorId?: number;
  classId?: number;
  mustChangePassword?: boolean;
}

export interface AuthTokenSigner {
  expiresIn: number;
  signAuthToken(payload: AuthTokenPayload): string;
}

export interface CreateAuthTokenSignerInput {
  secret: string;
  expiresInDays: number;
}

export interface AuthTokenVerifier {
  verifyAuthToken(token: string): AuthTokenPayload | null;
}

export interface CreateAuthTokenVerifierInput {
  secret: string;
}

const isPositiveInteger = (value: unknown): value is number => {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
};

const normalizeOptionalInteger = (value: unknown): number | undefined => {
  return isPositiveInteger(value) ? value : undefined;
};

const toVerifiedPayload = (payload: string | Record<string, unknown>): AuthTokenPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const sub = payload.sub;
  const role = payload.role;
  const account = payload.account;

  if (typeof sub !== "string" || (role !== "student" && role !== "teacher" && role !== "admin") || typeof account !== "string") {
    return null;
  }

  const studentId = normalizeOptionalInteger(payload.studentId);
  const displayName = typeof payload.displayName === "string" ? payload.displayName : undefined;
  const schoolId = normalizeOptionalInteger(payload.schoolId);
  const collegeId = normalizeOptionalInteger(payload.collegeId);
  const majorId = normalizeOptionalInteger(payload.majorId);
  const classId = normalizeOptionalInteger(payload.classId);
  const studentNo = typeof payload.studentNo === "string" ? payload.studentNo : undefined;
  const teacherId = typeof payload.teacherId === "string" ? payload.teacherId : undefined;
  const mustChangePassword = typeof payload.mustChangePassword === "boolean" ? payload.mustChangePassword : undefined;

  return {
    sub,
    role,
    account,
    displayName,
    studentId,
    studentNo,
    teacherId,
    schoolId,
    collegeId,
    majorId,
    classId,
    mustChangePassword
  };
};

export const createJwtAuthTokenSigner = ({
  secret,
  expiresInDays
}: CreateAuthTokenSignerInput): AuthTokenSigner => {
  const expiresIn = expiresInDays * SECONDS_PER_DAY;

  return {
    expiresIn,
    signAuthToken(payload) {
      return jwt.sign(payload as unknown as Record<string, unknown>, secret, { expiresIn });
    }
  };
};

export const createJwtAuthTokenVerifier = ({
  secret
}: CreateAuthTokenVerifierInput): AuthTokenVerifier => {
  return {
    verifyAuthToken(token) {
      try {
        const decoded = jwt.verify(token, secret);
        return toVerifiedPayload(decoded);
      } catch {
        return null;
      }
    }
  };
};

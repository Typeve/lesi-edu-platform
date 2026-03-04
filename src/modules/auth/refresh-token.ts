import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { AuthRole, AuthTokenPayload } from "./session-token.js";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken") as {
  sign(payload: Record<string, unknown>, secret: string, options: { expiresIn: number }): string;
  verify(token: string, secret: string): string | Record<string, unknown>;
};

const SECONDS_PER_DAY = 24 * 60 * 60;

interface RefreshTokenJwtPayload {
  sub: string;
  role: AuthRole;
  account: string;
  jti: string;
  tokenType: "refresh";
  displayName?: string;
  studentId?: number;
  studentNo?: string;
  teacherId?: string;
  schoolId?: number;
  collegeId?: number;
  majorId?: number;
  classId?: number;
  mustChangePassword?: boolean;
  exp?: number;
}

export interface VerifiedRefreshTokenPayload {
  jti: string;
  auth: AuthTokenPayload;
  expiresAt: Date;
}

export interface RefreshTokenSigner {
  expiresIn: number;
  signRefreshToken(auth: AuthTokenPayload): string;
}

export interface RefreshTokenVerifier {
  verifyRefreshToken(token: string): VerifiedRefreshTokenPayload | null;
}

const toPositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
};

const toDecodedRefreshPayload = (
  payload: string | Record<string, unknown>
): RefreshTokenJwtPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const sub = payload.sub;
  const role = payload.role;
  const account = payload.account;
  const jti = payload.jti;
  const tokenType = payload.tokenType;
  const exp = payload.exp;

  if (
    typeof sub !== "string" ||
    (role !== "student" && role !== "teacher" && role !== "admin") ||
    typeof account !== "string" ||
    typeof jti !== "string" ||
    tokenType !== "refresh" ||
    typeof exp !== "number"
  ) {
    return null;
  }

  return {
    sub,
    role,
    account,
    jti,
    tokenType: "refresh",
    exp,
    displayName: typeof payload.displayName === "string" ? payload.displayName : undefined,
    studentId: toPositiveInteger(payload.studentId),
    studentNo: typeof payload.studentNo === "string" ? payload.studentNo : undefined,
    teacherId: typeof payload.teacherId === "string" ? payload.teacherId : undefined,
    schoolId: toPositiveInteger(payload.schoolId),
    collegeId: toPositiveInteger(payload.collegeId),
    majorId: toPositiveInteger(payload.majorId),
    classId: toPositiveInteger(payload.classId),
    mustChangePassword: typeof payload.mustChangePassword === "boolean" ? payload.mustChangePassword : undefined
  };
};

export const createRefreshTokenSigner = ({
  secret,
  expiresInDays
}: {
  secret: string;
  expiresInDays: number;
}): RefreshTokenSigner => {
  const expiresIn = expiresInDays * SECONDS_PER_DAY;

  return {
    expiresIn,
    signRefreshToken(auth) {
      const payload: Record<string, unknown> = {
        sub: auth.sub,
        role: auth.role,
        account: auth.account,
        tokenType: "refresh",
        jti: randomUUID()
      };

      if (auth.displayName) payload.displayName = auth.displayName;
      if (auth.studentId) payload.studentId = auth.studentId;
      if (auth.studentNo) payload.studentNo = auth.studentNo;
      if (auth.teacherId) payload.teacherId = auth.teacherId;
      if (auth.schoolId) payload.schoolId = auth.schoolId;
      if (auth.collegeId) payload.collegeId = auth.collegeId;
      if (auth.majorId) payload.majorId = auth.majorId;
      if (auth.classId) payload.classId = auth.classId;
      if (typeof auth.mustChangePassword === "boolean") payload.mustChangePassword = auth.mustChangePassword;

      return jwt.sign(payload, secret, { expiresIn });
    }
  };
};

export const createRefreshTokenVerifier = ({
  secret
}: {
  secret: string;
}): RefreshTokenVerifier => {
  return {
    verifyRefreshToken(token) {
      try {
        const decoded = toDecodedRefreshPayload(jwt.verify(token, secret));
        if (!decoded) {
          return null;
        }

        return {
          jti: decoded.jti,
          auth: {
            sub: decoded.sub,
            role: decoded.role,
            account: decoded.account,
            displayName: decoded.displayName,
            studentId: decoded.studentId,
            studentNo: decoded.studentNo,
            teacherId: decoded.teacherId,
            schoolId: decoded.schoolId,
            collegeId: decoded.collegeId,
            majorId: decoded.majorId,
            classId: decoded.classId,
            mustChangePassword: decoded.mustChangePassword
          },
          expiresAt: new Date(decoded.exp! * 1000)
        };
      } catch {
        return null;
      }
    }
  };
};

export const hashRefreshToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

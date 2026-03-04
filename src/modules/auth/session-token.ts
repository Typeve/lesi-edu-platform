import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type {
  SessionRole,
  SessionTokenManager,
  SessionTokenPair,
  SessionUserView,
  VerifiedRefreshToken
} from "./session.js";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken") as {
  sign(payload: Record<string, unknown>, secret: string, options: { expiresIn: number }): string;
  verify(token: string, secret: string): string | Record<string, unknown>;
};

const SECONDS_PER_DAY = 24 * 60 * 60;
const DEFAULT_ACCESS_EXPIRES_IN_SECONDS = 15 * 60;
const DEFAULT_REFRESH_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;
const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

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

interface SessionJwtPayloadShape {
  sub: string;
  role: SessionRole;
  account: string;
  name: string;
  tokenType: "access" | "refresh";
  studentId?: number;
  studentNo?: string;
  teacherId?: string;
  exp?: number;
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

const isSessionRole = (value: unknown): value is SessionRole => {
  return value === "admin" || value === "teacher" || value === "student";
};

const toSessionPayload = (
  payload: string | Record<string, unknown>
): SessionJwtPayloadShape | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const sub = payload.sub;
  const role = payload.role;
  const account = payload.account;
  const name = payload.name;
  const tokenType = payload.tokenType;
  const exp = payload.exp;

  if (
    typeof sub !== "string" ||
    !isSessionRole(role) ||
    typeof account !== "string" ||
    typeof name !== "string" ||
    (tokenType !== ACCESS_TOKEN_TYPE && tokenType !== REFRESH_TOKEN_TYPE)
  ) {
    return null;
  }

  const basePayload: SessionJwtPayloadShape = {
    sub,
    role,
    account,
    name,
    tokenType
  };

  if (typeof payload.studentNo === "string") {
    basePayload.studentNo = payload.studentNo;
  }
  if (typeof payload.teacherId === "string") {
    basePayload.teacherId = payload.teacherId;
  }
  if (typeof payload.studentId === "number" && Number.isInteger(payload.studentId)) {
    basePayload.studentId = payload.studentId;
  }
  if (typeof exp === "number" && Number.isInteger(exp)) {
    basePayload.exp = exp;
  }

  return basePayload;
};

const toSessionUserView = (payload: SessionJwtPayloadShape): SessionUserView => {
  return {
    userId: payload.sub,
    role: payload.role,
    account: payload.account,
    name: payload.name,
    studentNo: payload.studentNo,
    teacherId: payload.teacherId,
    studentId: payload.studentId
  };
};

const signSessionToken = ({
  secret,
  expiresInSeconds,
  tokenType,
  user
}: {
  secret: string;
  expiresInSeconds: number;
  tokenType: "access" | "refresh";
  user: SessionUserView;
}): string => {
  const payload: Record<string, unknown> = {
    sub: user.userId,
    role: user.role,
    account: user.account,
    name: user.name,
    tokenType
  };

  if (user.studentId) {
    payload.studentId = user.studentId;
  }
  if (user.studentNo) {
    payload.studentNo = user.studentNo;
  }
  if (user.teacherId) {
    payload.teacherId = user.teacherId;
  }
  if (tokenType === REFRESH_TOKEN_TYPE) {
    payload.jti = randomUUID();
  }

  return jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
};

const verifySessionToken = (
  secret: string,
  token: string,
  expectedTokenType: "access" | "refresh"
): SessionJwtPayloadShape | null => {
  try {
    const payload = jwt.verify(token, secret);
    const decoded = toSessionPayload(payload);
    if (!decoded || decoded.tokenType !== expectedTokenType) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
};

export const createJwtSessionTokenManager = ({
  secret,
  accessExpiresInSeconds = DEFAULT_ACCESS_EXPIRES_IN_SECONDS,
  refreshExpiresInSeconds = DEFAULT_REFRESH_EXPIRES_IN_SECONDS
}: {
  secret: string;
  accessExpiresInSeconds?: number;
  refreshExpiresInSeconds?: number;
}): SessionTokenManager => {
  return {
    createTokenPair(user): SessionTokenPair {
      const accessToken = signSessionToken({
        secret,
        expiresInSeconds: accessExpiresInSeconds,
        tokenType: ACCESS_TOKEN_TYPE,
        user
      });
      const refreshToken = signSessionToken({
        secret,
        expiresInSeconds: refreshExpiresInSeconds,
        tokenType: REFRESH_TOKEN_TYPE,
        user
      });

      return {
        accessToken,
        refreshToken,
        accessExpiresIn: accessExpiresInSeconds,
        refreshExpiresIn: refreshExpiresInSeconds,
        refreshExpiresAt: new Date(Date.now() + refreshExpiresInSeconds * 1000)
      };
    },
    verifyAccessToken(token) {
      const payload = verifySessionToken(secret, token, ACCESS_TOKEN_TYPE);
      if (!payload) {
        return null;
      }
      return toSessionUserView(payload);
    },
    verifyRefreshToken(token): VerifiedRefreshToken | null {
      const payload = verifySessionToken(secret, token, REFRESH_TOKEN_TYPE);
      if (!payload || !payload.exp) {
        return null;
      }

      return {
        user: toSessionUserView(payload),
        expiresAt: new Date(payload.exp * 1000)
      };
    }
  };
};

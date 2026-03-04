import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
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

const DEFAULT_ACCESS_EXPIRES_IN_SECONDS = 15 * 60;
const DEFAULT_REFRESH_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;
const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

interface CreateJwtSessionTokenManagerInput {
  secret: string;
  accessExpiresInSeconds?: number;
  refreshExpiresInSeconds?: number;
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

const isSessionRole = (value: unknown): value is SessionRole => {
  return value === "admin" || value === "teacher" || value === "student";
};

const isValidSessionUser = (value: SessionUserView): boolean => {
  if (!value.userId || !value.account || !value.name) {
    return false;
  }

  if (!isSessionRole(value.role)) {
    return false;
  }

  return true;
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

const toUserView = (payload: SessionJwtPayloadShape): SessionUserView => {
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

const toRefreshExpiresAt = (payload: SessionJwtPayloadShape): Date | null => {
  if (!payload.exp) {
    return null;
  }

  return new Date(payload.exp * 1000);
};

const signToken = ({
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

const verifyTokenPayload = (
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

const toTokenPair = ({
  user,
  secret,
  accessExpiresIn,
  refreshExpiresIn
}: {
  user: SessionUserView;
  secret: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}): SessionTokenPair => {
  const accessToken = signToken({
    secret,
    expiresInSeconds: accessExpiresIn,
    tokenType: ACCESS_TOKEN_TYPE,
    user
  });
  const refreshToken = signToken({
    secret,
    expiresInSeconds: refreshExpiresIn,
    tokenType: REFRESH_TOKEN_TYPE,
    user
  });

  return {
    accessToken,
    refreshToken,
    accessExpiresIn,
    refreshExpiresIn,
    refreshExpiresAt: new Date(Date.now() + refreshExpiresIn * 1000)
  };
};

const toVerifiedRefreshToken = (payload: SessionJwtPayloadShape): VerifiedRefreshToken | null => {
  const expiresAt = toRefreshExpiresAt(payload);
  if (!expiresAt) {
    return null;
  }

  return {
    user: toUserView(payload),
    expiresAt
  };
};

export const createJwtSessionTokenManager = ({
  secret,
  accessExpiresInSeconds = DEFAULT_ACCESS_EXPIRES_IN_SECONDS,
  refreshExpiresInSeconds = DEFAULT_REFRESH_EXPIRES_IN_SECONDS
}: CreateJwtSessionTokenManagerInput): SessionTokenManager => {
  return {
    createTokenPair(user) {
      if (!isValidSessionUser(user)) {
        throw new Error("invalid session user");
      }

      return toTokenPair({
        user,
        secret,
        accessExpiresIn: accessExpiresInSeconds,
        refreshExpiresIn: refreshExpiresInSeconds
      });
    },
    verifyAccessToken(token) {
      const payload = verifyTokenPayload(secret, token, ACCESS_TOKEN_TYPE);
      if (!payload) {
        return null;
      }

      return toUserView(payload);
    },
    verifyRefreshToken(token) {
      const payload = verifyTokenPayload(secret, token, REFRESH_TOKEN_TYPE);
      if (!payload) {
        return null;
      }

      return toVerifiedRefreshToken(payload);
    }
  };
};

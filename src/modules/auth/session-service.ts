import { createHash } from "node:crypto";
import type {
  CreateSessionAuthServiceInput,
  SessionAuthResult,
  SessionRefreshTokenRecord,
  SessionUserView
} from "./session.js";
import { SessionAuthUnauthorizedError } from "./session.js";

const DUMMY_PASSWORD_HASH = "$2b$10$ykqJ8CfeprKl2UpQm9a7ZOv9wZWyG2J.AoPTB5oTvbGdZyc/Ljcsm";

const hasUsablePasswordHash = (passwordHash: string | null): passwordHash is string => {
  return typeof passwordHash === "string" && passwordHash.trim().length > 0;
};

const hashRefreshToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

const toSessionUserView = (account: {
  userId: string;
  role: "admin" | "teacher" | "student";
  account: string;
  name: string;
  teacherId?: string;
  studentId?: number;
  studentNo?: string;
}): SessionUserView => {
  return {
    userId: account.userId,
    role: account.role,
    account: account.account,
    name: account.name,
    teacherId: account.teacherId,
    studentId: account.studentId,
    studentNo: account.studentNo
  };
};

const toSessionAuthResult = ({
  user,
  pair
}: {
  user: SessionUserView;
  pair: {
    accessToken: string;
    refreshToken: string;
    accessExpiresIn: number;
    refreshExpiresIn: number;
  };
}): SessionAuthResult => {
  return {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    expiresIn: pair.accessExpiresIn,
    refreshExpiresIn: pair.refreshExpiresIn,
    user
  };
};

const isSessionUserSame = (left: SessionUserView, right: SessionUserView): boolean => {
  return left.userId === right.userId && left.role === right.role && left.account === right.account;
};

const isRefreshRecordActive = (record: SessionRefreshTokenRecord, now: Date): boolean => {
  if (record.revokedAt) {
    return false;
  }

  return record.expiresAt.getTime() > now.getTime();
};

const buildRefreshRecord = ({
  tokenHash,
  user,
  refreshExpiresAt,
  now
}: {
  tokenHash: string;
  user: SessionUserView;
  refreshExpiresAt: Date;
  now: Date;
}): SessionRefreshTokenRecord => {
  return {
    tokenHash,
    user,
    createdAt: now,
    expiresAt: refreshExpiresAt,
    revokedAt: null
  };
};

export const createSessionAuthService = ({
  accountRepo,
  refreshTokenRepo,
  passwordVerifier,
  tokenManager
}: CreateSessionAuthServiceInput) => {
  return {
    async login({ account, password }) {
      const normalizedAccount = account.trim();
      const accountRecord = await accountRepo.findByAccount(normalizedAccount);
      const passwordHashForCompare = hasUsablePasswordHash(accountRecord?.passwordHash ?? null)
        ? accountRecord!.passwordHash
        : DUMMY_PASSWORD_HASH;
      const passwordMatched = await passwordVerifier.compare(password, passwordHashForCompare);
      const isFrozen = accountRecord?.status === "frozen";

      if (!accountRecord || !hasUsablePasswordHash(accountRecord.passwordHash) || !passwordMatched || isFrozen) {
        throw new SessionAuthUnauthorizedError();
      }

      const user = toSessionUserView(accountRecord);
      const tokenPair = tokenManager.createTokenPair(user);
      const tokenHash = hashRefreshToken(tokenPair.refreshToken);
      const now = new Date();

      await refreshTokenRepo.save(
        buildRefreshRecord({
          tokenHash,
          user,
          refreshExpiresAt: tokenPair.refreshExpiresAt,
          now
        })
      );

      return toSessionAuthResult({
        user,
        pair: tokenPair
      });
    },
    async refresh({ refreshToken }) {
      const verifiedToken = tokenManager.verifyRefreshToken(refreshToken);
      if (!verifiedToken) {
        throw new SessionAuthUnauthorizedError();
      }

      const now = new Date();
      const refreshTokenHash = hashRefreshToken(refreshToken);
      const existingRecord = await refreshTokenRepo.findByTokenHash(refreshTokenHash);

      if (!existingRecord || !isRefreshRecordActive(existingRecord, now)) {
        throw new SessionAuthUnauthorizedError();
      }

      if (!isSessionUserSame(existingRecord.user, verifiedToken.user)) {
        throw new SessionAuthUnauthorizedError();
      }

      await refreshTokenRepo.revokeByTokenHash(refreshTokenHash, now);

      const tokenPair = tokenManager.createTokenPair(verifiedToken.user);
      const nextTokenHash = hashRefreshToken(tokenPair.refreshToken);

      await refreshTokenRepo.save(
        buildRefreshRecord({
          tokenHash: nextTokenHash,
          user: verifiedToken.user,
          refreshExpiresAt: tokenPair.refreshExpiresAt,
          now
        })
      );

      return toSessionAuthResult({
        user: verifiedToken.user,
        pair: tokenPair
      });
    },
    async logout({ refreshToken }) {
      const now = new Date();
      const refreshTokenHash = hashRefreshToken(refreshToken);
      await refreshTokenRepo.revokeByTokenHash(refreshTokenHash, now);
    },
    async getSessionUser({ accessToken }) {
      const user = tokenManager.verifyAccessToken(accessToken);
      if (!user) {
        throw new SessionAuthUnauthorizedError();
      }

      return user;
    }
  };
};

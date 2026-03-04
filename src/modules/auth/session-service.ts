import { createHash } from "node:crypto";
import type { PasswordVerifier } from "./password.js";
import type { AuthTokenPayload, AuthTokenSigner, AuthTokenVerifier } from "./session-token.js";
import type {
  CreateSessionAuthServiceInput as LegacyCreateSessionAuthServiceInput,
  SessionAccountRecord,
  SessionAuthService as LegacySessionAuthService,
  SessionRefreshTokenRecord,
  SessionUserView
} from "./session.js";
import { SessionAuthUnauthorizedError } from "./session.js";
import type {
  RefreshTokenSigner,
  RefreshTokenVerifier,
  VerifiedRefreshTokenPayload
} from "./refresh-token.js";
import { hashRefreshToken } from "./refresh-token.js";

const DUMMY_PASSWORD_HASH = "$2b$10$ykqJ8CfeprKl2UpQm9a7ZOv9wZWyG2J.AoPTB5oTvbGdZyc/Ljcsm";

export interface SessionLoginResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  user: {
    userId: string;
    role: AuthTokenPayload["role"];
    displayName: string;
    name?: string;
    account: string;
    teacherId?: string;
    studentId?: number;
    studentNo?: string;
  };
}

export interface SessionAuthService {
  login(input: { account: string; password: string }): Promise<SessionLoginResult>;
  refresh(input: string | { refreshToken: string }): Promise<SessionLoginResult>;
  logout(input: string | { refreshToken: string }): Promise<void>;
  me(accessToken: string): Promise<AuthTokenPayload>;
  getSessionUser?(input: { accessToken: string }): Promise<SessionUserView>;
}

export interface SessionAuthenticator {
  loginByAccount(account: string, password: string): Promise<AuthTokenPayload>;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  auth: AuthTokenPayload;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface RefreshTokenRepository {
  save(record: RefreshTokenRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
}

export class SessionUnauthorizedError extends SessionAuthUnauthorizedError {
  constructor() {
    super();
    this.name = "SessionUnauthorizedError";
  }
}

interface ModernCreateSessionAuthServiceInput {
  authenticator: SessionAuthenticator;
  authTokenSigner: AuthTokenSigner;
  authTokenVerifier: AuthTokenVerifier;
  refreshTokenSigner: RefreshTokenSigner;
  refreshTokenVerifier: RefreshTokenVerifier;
  refreshTokenRepo: RefreshTokenRepository;
}

const toPublicUser = (auth: AuthTokenPayload): SessionLoginResult["user"] => ({
  userId: auth.sub,
  role: auth.role,
  displayName: auth.displayName ?? auth.account,
  name: auth.displayName ?? auth.account,
  account: auth.account,
  teacherId: auth.teacherId,
  studentId: auth.studentId,
  studentNo: auth.studentNo
});

const toAuthPayloadFromSessionUser = (user: SessionUserView): AuthTokenPayload => ({
  sub: user.userId,
  role: user.role,
  account: user.account,
  displayName: user.name,
  teacherId: user.teacherId,
  studentId: user.studentId,
  studentNo: user.studentNo
});

const toSessionUserFromAuthPayload = (auth: AuthTokenPayload): SessionUserView => ({
  userId: auth.sub,
  role: auth.role,
  account: auth.account,
  name: auth.displayName ?? auth.account,
  teacherId: auth.teacherId,
  studentId: auth.studentId,
  studentNo: auth.studentNo
});

const resolveRefreshToken = (input: string | { refreshToken: string }): string => {
  return typeof input === "string" ? input : input.refreshToken;
};

const isRefreshTokenRecordActive = (record: RefreshTokenRecord, now: Date): boolean => {
  if (record.revokedAt) {
    return false;
  }
  return record.expiresAt.getTime() > now.getTime();
};

const isAuthSubjectSame = (left: AuthTokenPayload, right: AuthTokenPayload): boolean => {
  return left.sub === right.sub && left.role === right.role && left.account === right.account;
};

const buildRefreshRecord = ({
  refreshToken,
  verifiedRefreshToken,
  now
}: {
  refreshToken: string;
  verifiedRefreshToken: VerifiedRefreshTokenPayload;
  now: Date;
}): RefreshTokenRecord => ({
  tokenHash: hashRefreshToken(refreshToken),
  auth: verifiedRefreshToken.auth,
  expiresAt: verifiedRefreshToken.expiresAt,
  revokedAt: null,
  createdAt: now
});

const hasUsablePasswordHash = (passwordHash: string | null): passwordHash is string => {
  return typeof passwordHash === "string" && passwordHash.trim().length > 0;
};

const toLegacySessionAuthResult = ({
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
}): SessionLoginResult => ({
  accessToken: pair.accessToken,
  refreshToken: pair.refreshToken,
  expiresIn: pair.accessExpiresIn,
  refreshExpiresIn: pair.refreshExpiresIn,
  user: {
    userId: user.userId,
    role: user.role,
    account: user.account,
    displayName: user.name,
    name: user.name,
    teacherId: user.teacherId,
    studentId: user.studentId,
    studentNo: user.studentNo
  }
});

const isSessionUserSame = (left: SessionUserView, right: SessionUserView): boolean => {
  return left.userId === right.userId && left.role === right.role && left.account === right.account;
};

const isLegacyRefreshRecordActive = (record: SessionRefreshTokenRecord, now: Date): boolean => {
  if (record.revokedAt) {
    return false;
  }

  return record.expiresAt.getTime() > now.getTime();
};

const toLegacyRefreshRecord = ({
  tokenHash,
  user,
  refreshExpiresAt,
  now
}: {
  tokenHash: string;
  user: SessionUserView;
  refreshExpiresAt: Date;
  now: Date;
}): SessionRefreshTokenRecord => ({
  tokenHash,
  user,
  createdAt: now,
  expiresAt: refreshExpiresAt,
  revokedAt: null
});

const createLegacyService = ({
  accountRepo,
  refreshTokenRepo,
  passwordVerifier,
  tokenManager
}: LegacyCreateSessionAuthServiceInput): SessionAuthService => {
  return {
    async login({ account, password }) {
      const normalizedAccount = account.trim();
      const accountRecord = await accountRepo.findByAccount(normalizedAccount);
      const accountPasswordHash = accountRecord?.passwordHash ?? null;
      const passwordHashForCompare = hasUsablePasswordHash(accountPasswordHash)
        ? accountPasswordHash
        : DUMMY_PASSWORD_HASH;
      const passwordMatched = await passwordVerifier.compare(password, passwordHashForCompare);
      const isFrozen = accountRecord?.status === "frozen";

      if (!accountRecord || !hasUsablePasswordHash(accountRecord.passwordHash) || !passwordMatched || isFrozen) {
        throw new SessionUnauthorizedError();
      }

      const user: SessionUserView = {
        userId: accountRecord.userId,
        role: accountRecord.role,
        account: accountRecord.account,
        name: accountRecord.name,
        teacherId: accountRecord.teacherId,
        studentId: accountRecord.studentId,
        studentNo: accountRecord.studentNo
      };

      const tokenPair = tokenManager.createTokenPair(user);
      const tokenHash = createHash("sha256").update(tokenPair.refreshToken).digest("hex");
      const now = new Date();

      await refreshTokenRepo.save(
        toLegacyRefreshRecord({
          tokenHash,
          user,
          refreshExpiresAt: tokenPair.refreshExpiresAt,
          now
        })
      );

      return toLegacySessionAuthResult({
        user,
        pair: tokenPair
      });
    },

    async refresh(input) {
      const refreshToken = resolveRefreshToken(input);
      const verifiedToken = tokenManager.verifyRefreshToken(refreshToken);
      if (!verifiedToken) {
        throw new SessionUnauthorizedError();
      }

      const now = new Date();
      const refreshTokenHash = createHash("sha256").update(refreshToken).digest("hex");
      const existingRecord = await refreshTokenRepo.findByTokenHash(refreshTokenHash);

      if (!existingRecord || !isLegacyRefreshRecordActive(existingRecord, now)) {
        throw new SessionUnauthorizedError();
      }

      if (!isSessionUserSame(existingRecord.user, verifiedToken.user)) {
        throw new SessionUnauthorizedError();
      }

      await refreshTokenRepo.revokeByTokenHash(refreshTokenHash, now);

      const tokenPair = tokenManager.createTokenPair(verifiedToken.user);
      const nextTokenHash = createHash("sha256").update(tokenPair.refreshToken).digest("hex");

      await refreshTokenRepo.save(
        toLegacyRefreshRecord({
          tokenHash: nextTokenHash,
          user: verifiedToken.user,
          refreshExpiresAt: tokenPair.refreshExpiresAt,
          now
        })
      );

      return toLegacySessionAuthResult({
        user: verifiedToken.user,
        pair: tokenPair
      });
    },

    async logout(input) {
      const refreshToken = resolveRefreshToken(input);
      const now = new Date();
      const refreshTokenHash = createHash("sha256").update(refreshToken).digest("hex");
      await refreshTokenRepo.revokeByTokenHash(refreshTokenHash, now);
    },

    async me(accessToken: string) {
      const user = tokenManager.verifyAccessToken(accessToken);
      if (!user) {
        throw new SessionUnauthorizedError();
      }

      return toAuthPayloadFromSessionUser(user);
    },

    async getSessionUser({ accessToken }) {
      const user = tokenManager.verifyAccessToken(accessToken);
      if (!user) {
        throw new SessionUnauthorizedError();
      }
      return user;
    }
  };
};

const createModernService = ({
  authenticator,
  authTokenSigner,
  authTokenVerifier,
  refreshTokenSigner,
  refreshTokenVerifier,
  refreshTokenRepo
}: ModernCreateSessionAuthServiceInput): SessionAuthService => {
  return {
    async login({
      account,
      password
    }: {
      account: string;
      password: string;
    }): Promise<SessionLoginResult> {
      const auth = await authenticator.loginByAccount(account, password);
      const accessToken = authTokenSigner.signAuthToken(auth);
      const refreshToken = refreshTokenSigner.signRefreshToken(auth);
      const verifiedRefreshToken = refreshTokenVerifier.verifyRefreshToken(refreshToken);

      if (!verifiedRefreshToken) {
        throw new SessionUnauthorizedError();
      }

      await refreshTokenRepo.save(
        buildRefreshRecord({
          refreshToken,
          verifiedRefreshToken,
          now: new Date()
        })
      );

      return {
        accessToken,
        expiresIn: authTokenSigner.expiresIn,
        refreshToken,
        refreshExpiresIn: refreshTokenSigner.expiresIn,
        user: toPublicUser(auth)
      };
    },

    async refresh(input): Promise<SessionLoginResult> {
      const refreshToken = resolveRefreshToken(input);
      const verifiedRefreshToken = refreshTokenVerifier.verifyRefreshToken(refreshToken);
      if (!verifiedRefreshToken) {
        throw new SessionUnauthorizedError();
      }

      const now = new Date();
      const tokenHash = hashRefreshToken(refreshToken);
      const existing = await refreshTokenRepo.findByTokenHash(tokenHash);
      if (!existing || !isRefreshTokenRecordActive(existing, now)) {
        throw new SessionUnauthorizedError();
      }

      if (!isAuthSubjectSame(existing.auth, verifiedRefreshToken.auth)) {
        throw new SessionUnauthorizedError();
      }

      await refreshTokenRepo.revokeByTokenHash(tokenHash, now);

      const nextAccessToken = authTokenSigner.signAuthToken(verifiedRefreshToken.auth);
      const nextRefreshToken = refreshTokenSigner.signRefreshToken(verifiedRefreshToken.auth);
      const verifiedNextRefreshToken = refreshTokenVerifier.verifyRefreshToken(nextRefreshToken);
      if (!verifiedNextRefreshToken) {
        throw new SessionUnauthorizedError();
      }

      await refreshTokenRepo.save(
        buildRefreshRecord({
          refreshToken: nextRefreshToken,
          verifiedRefreshToken: verifiedNextRefreshToken,
          now
        })
      );

      return {
        accessToken: nextAccessToken,
        expiresIn: authTokenSigner.expiresIn,
        refreshToken: nextRefreshToken,
        refreshExpiresIn: refreshTokenSigner.expiresIn,
        user: toPublicUser(verifiedRefreshToken.auth)
      };
    },

    async logout(input): Promise<void> {
      const refreshToken = resolveRefreshToken(input);
      await refreshTokenRepo.revokeByTokenHash(hashRefreshToken(refreshToken), new Date());
    },

    async me(accessToken: string): Promise<AuthTokenPayload> {
      const auth = authTokenVerifier.verifyAuthToken(accessToken);
      if (!auth) {
        throw new SessionUnauthorizedError();
      }
      return auth;
    },

    async getSessionUser({ accessToken }) {
      const auth = authTokenVerifier.verifyAuthToken(accessToken);
      if (!auth) {
        throw new SessionUnauthorizedError();
      }
      return toSessionUserFromAuthPayload(auth);
    }
  };
};

export const createSessionAuthService = (
  input: LegacyCreateSessionAuthServiceInput | ModernCreateSessionAuthServiceInput
): SessionAuthService => {
  if ("accountRepo" in input && "tokenManager" in input) {
    return createLegacyService(input);
  }

  return createModernService(input);
};

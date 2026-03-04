import type { AuthTokenPayload, AuthTokenSigner, AuthTokenVerifier } from "./session-token.js";
import type {
  RefreshTokenSigner,
  RefreshTokenVerifier,
  VerifiedRefreshTokenPayload
} from "./refresh-token.js";
import { hashRefreshToken } from "./refresh-token.js";

export interface SessionLoginResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  user: {
    userId: string;
    role: AuthTokenPayload["role"];
    displayName: string;
    account: string;
  };
}

export interface SessionAuthService {
  login(input: { account: string; password: string }): Promise<SessionLoginResult>;
  refresh(refreshToken: string): Promise<SessionLoginResult>;
  logout(refreshToken: string): Promise<void>;
  me(accessToken: string): Promise<AuthTokenPayload>;
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

export class SessionUnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "SessionUnauthorizedError";
  }
}

const toPublicUser = (auth: AuthTokenPayload) => ({
  userId: auth.sub,
  role: auth.role,
  displayName: auth.displayName ?? auth.account,
  account: auth.account
});

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
}): RefreshTokenRecord => {
  return {
    tokenHash: hashRefreshToken(refreshToken),
    auth: verifiedRefreshToken.auth,
    expiresAt: verifiedRefreshToken.expiresAt,
    revokedAt: null,
    createdAt: now
  };
};

export const createSessionAuthService = ({
  authenticator,
  authTokenSigner,
  authTokenVerifier,
  refreshTokenSigner,
  refreshTokenVerifier,
  refreshTokenRepo
}: {
  authenticator: SessionAuthenticator;
  authTokenSigner: AuthTokenSigner;
  authTokenVerifier: AuthTokenVerifier;
  refreshTokenSigner: RefreshTokenSigner;
  refreshTokenVerifier: RefreshTokenVerifier;
  refreshTokenRepo: RefreshTokenRepository;
}): SessionAuthService => {
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

    async refresh(refreshToken: string): Promise<SessionLoginResult> {
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

    async logout(refreshToken: string): Promise<void> {
      await refreshTokenRepo.revokeByTokenHash(hashRefreshToken(refreshToken), new Date());
    },

    async me(accessToken: string): Promise<AuthTokenPayload> {
      const auth = authTokenVerifier.verifyAuthToken(accessToken);
      if (!auth) {
        throw new SessionUnauthorizedError();
      }
      return auth;
    }
  };
};

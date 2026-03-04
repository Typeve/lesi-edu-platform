import type { PasswordVerifier } from "./password.js";

export type SessionRole = "admin" | "teacher" | "student";

export interface SessionUserView {
  userId: string;
  role: SessionRole;
  account: string;
  name: string;
  teacherId?: string;
  studentId?: number;
  studentNo?: string;
}

export interface SessionAccountRecord extends SessionUserView {
  passwordHash: string | null;
  status?: "active" | "frozen";
}

export interface SessionAccountRepository {
  findByAccount(account: string): Promise<SessionAccountRecord | null>;
}

export interface SessionRefreshTokenRecord {
  tokenHash: string;
  user: SessionUserView;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface SessionRefreshTokenRepository {
  save(record: SessionRefreshTokenRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRefreshTokenRecord | null>;
  revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
}

export interface SessionTokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  refreshExpiresAt: Date;
}

export interface VerifiedRefreshToken {
  user: SessionUserView;
  expiresAt: Date;
}

export interface SessionTokenManager {
  createTokenPair(user: SessionUserView): SessionTokenPair;
  verifyAccessToken(token: string): SessionUserView | null;
  verifyRefreshToken(token: string): VerifiedRefreshToken | null;
}

export interface SessionLoginInput {
  account: string;
  password: string;
}

export interface SessionLogoutInput {
  refreshToken: string;
}

export interface SessionRefreshInput {
  refreshToken: string;
}

export interface SessionMeInput {
  accessToken: string;
}

export interface SessionAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  user: SessionUserView;
}

export interface SessionAuthService {
  login(input: SessionLoginInput): Promise<SessionAuthResult>;
  refresh(input: SessionRefreshInput): Promise<SessionAuthResult>;
  logout(input: SessionLogoutInput): Promise<void>;
  getSessionUser(input: SessionMeInput): Promise<SessionUserView>;
}

export interface CreateSessionAuthServiceInput {
  accountRepo: SessionAccountRepository;
  refreshTokenRepo: SessionRefreshTokenRepository;
  passwordVerifier: PasswordVerifier;
  tokenManager: SessionTokenManager;
}

export class SessionAuthUnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "SessionAuthUnauthorizedError";
  }
}

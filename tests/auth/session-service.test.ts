import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import bcrypt from "bcryptjs";
import { bcryptPasswordVerifier } from "../../src/modules/auth/password.ts";
import { createSessionAuthService } from "../../src/modules/auth/session-service.ts";
import { createJwtSessionTokenManager } from "../../src/modules/auth/session-token.ts";
import {
  SessionAuthUnauthorizedError,
  type SessionAccountRecord,
  type SessionRefreshTokenRecord
} from "../../src/modules/auth/session.ts";

interface SessionTestContext {
  account: SessionAccountRecord;
  refreshTokenRecords: Map<string, SessionRefreshTokenRecord>;
}

const testJwtSecret = "s".repeat(32);

const hashRefreshToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

const buildContext = async (): Promise<SessionTestContext> => {
  return {
    account: {
      userId: "teacher:T-001",
      role: "teacher",
      account: "teacher.chen",
      name: "陈老师",
      teacherId: "T-001",
      passwordHash: await bcrypt.hash("Passw0rd!", 4),
      status: "active"
    },
    refreshTokenRecords: new Map<string, SessionRefreshTokenRecord>()
  };
};

const createService = (ctx: SessionTestContext) => {
  return createSessionAuthService({
    accountRepo: {
      async findByAccount(account) {
        return account === ctx.account.account ? ctx.account : null;
      }
    },
    refreshTokenRepo: {
      async save(record) {
        ctx.refreshTokenRecords.set(record.tokenHash, record);
      },
      async findByTokenHash(tokenHash) {
        return ctx.refreshTokenRecords.get(tokenHash) ?? null;
      },
      async revokeByTokenHash(tokenHash, revokedAt) {
        const existing = ctx.refreshTokenRecords.get(tokenHash);
        if (!existing) {
          return;
        }

        ctx.refreshTokenRecords.set(tokenHash, {
          ...existing,
          revokedAt
        });
      }
    },
    passwordVerifier: bcryptPasswordVerifier,
    tokenManager: createJwtSessionTokenManager({
      secret: testJwtSecret,
      accessExpiresInSeconds: 60,
      refreshExpiresInSeconds: 300
    })
  });
};

test("session service login should issue token pair and persist hashed refresh token", async () => {
  const ctx = await buildContext();
  const service = createService(ctx);
  const result = await service.login({
    account: "teacher.chen",
    password: "Passw0rd!"
  });

  assert.equal(typeof result.accessToken, "string");
  assert.equal(typeof result.refreshToken, "string");
  assert.equal(result.user.userId, "teacher:T-001");
  assert.equal(ctx.refreshTokenRecords.size, 1);

  const savedHashes = [...ctx.refreshTokenRecords.keys()];
  assert.equal(savedHashes.length, 1);
  assert.equal(savedHashes[0], hashRefreshToken(result.refreshToken));
  assert.equal(savedHashes[0].length, 64);
});

test("session service login should reject invalid password", async () => {
  const ctx = await buildContext();
  const service = createService(ctx);

  await assert.rejects(
    async () => {
      await service.login({
        account: "teacher.chen",
        password: "WrongPass1!"
      });
    },
    (error) => error instanceof SessionAuthUnauthorizedError
  );
});

test("session service refresh should rotate refresh token and revoke previous token", async () => {
  const ctx = await buildContext();
  const service = createService(ctx);

  const firstLoginResult = await service.login({
    account: "teacher.chen",
    password: "Passw0rd!"
  });
  const firstTokenHash = hashRefreshToken(firstLoginResult.refreshToken);

  const refreshedResult = await service.refresh({
    refreshToken: firstLoginResult.refreshToken
  });
  const secondTokenHash = hashRefreshToken(refreshedResult.refreshToken);

  assert.notEqual(firstTokenHash, secondTokenHash);
  assert.equal(ctx.refreshTokenRecords.size, 2);
  assert.ok(ctx.refreshTokenRecords.get(firstTokenHash)?.revokedAt);
  assert.equal(ctx.refreshTokenRecords.get(secondTokenHash)?.revokedAt, null);

  await assert.rejects(
    async () => {
      await service.refresh({
        refreshToken: firstLoginResult.refreshToken
      });
    },
    (error) => error instanceof SessionAuthUnauthorizedError
  );
});

test("session service logout should revoke existing refresh token", async () => {
  const ctx = await buildContext();
  const service = createService(ctx);

  const loginResult = await service.login({
    account: "teacher.chen",
    password: "Passw0rd!"
  });
  const tokenHash = hashRefreshToken(loginResult.refreshToken);

  await service.logout({
    refreshToken: loginResult.refreshToken
  });

  assert.ok(ctx.refreshTokenRecords.get(tokenHash)?.revokedAt);
});

test("session service me should return user from access token", async () => {
  const ctx = await buildContext();
  const service = createService(ctx);
  const loginResult = await service.login({
    account: "teacher.chen",
    password: "Passw0rd!"
  });

  const user = await service.getSessionUser({
    accessToken: loginResult.accessToken
  });

  assert.deepEqual(user, {
    userId: "teacher:T-001",
    role: "teacher",
    account: "teacher.chen",
    name: "陈老师",
    teacherId: "T-001",
    studentNo: undefined,
    studentId: undefined
  });
});

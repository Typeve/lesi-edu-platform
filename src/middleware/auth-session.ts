import type { Context, MiddlewareHandler } from "hono";
import type { AuthRole, AuthTokenPayload, AuthTokenVerifier } from "../modules/auth/session-token.js";

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthTokenPayload;
  }
}

const BEARER_TOKEN_PATTERN = /^bearer\s+(\S+)\s*$/i;

const parseBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const matched = authorizationHeader.trim().match(BEARER_TOKEN_PATTERN);
  if (!matched) {
    return null;
  }

  return matched[1];
};

export const createRequireAuthMiddleware = ({
  tokenVerifier
}: {
  tokenVerifier: AuthTokenVerifier;
}): MiddlewareHandler => {
  return async (c, next) => {
    const token = parseBearerToken(c.req.header("authorization"));
    if (!token) {
      return c.json({ message: "unauthorized" }, 401);
    }

    const verified = tokenVerifier.verifyAuthToken(token);
    if (!verified) {
      return c.json({ message: "unauthorized" }, 401);
    }

    c.set("auth", verified);
    await next();
  };
};

export const createRequireRoleMiddleware = ({
  tokenVerifier,
  roles
}: {
  tokenVerifier: AuthTokenVerifier;
  roles: AuthRole[];
}): MiddlewareHandler => {
  const requireAuth = createRequireAuthMiddleware({ tokenVerifier });

  return async (c, next) => {
    let passedAuth = false;
    await requireAuth(c, async () => {
      passedAuth = true;
    });

    if (!passedAuth) {
      return;
    }

    const auth = c.get("auth");
    if (!auth || !roles.includes(auth.role)) {
      c.status(403);
      c.json({ message: "forbidden" });
      return;
    }

    await next();
  };
};

export type PermissionChecker = (input: {
  auth: AuthTokenPayload;
  permission: string;
}) => boolean;

export const createRequirePermissionFactory = ({
  tokenVerifier,
  permissionChecker
}: {
  tokenVerifier: AuthTokenVerifier;
  permissionChecker: PermissionChecker;
}): ((permission: string) => MiddlewareHandler) => {
  const requireAuth = createRequireAuthMiddleware({ tokenVerifier });

  return (permission: string) => {
    return async (c, next) => {
      let passedAuth = false;
      await requireAuth(c, async () => {
        passedAuth = true;
      });

      if (!passedAuth) {
        return;
      }

      const auth = c.get("auth");
      if (!auth || !permissionChecker({ auth, permission })) {
        return c.json({ message: "forbidden" }, 403);
      }

      await next();
    };
  };
};

export type ScopeChecker = (input: {
  auth: AuthTokenPayload;
  context: Context;
}) => boolean | Promise<boolean>;

export const createRequireScopeFactory = ({
  tokenVerifier,
  scopeChecker
}: {
  tokenVerifier: AuthTokenVerifier;
  scopeChecker: ScopeChecker;
}): (() => MiddlewareHandler) => {
  const requireAuth = createRequireAuthMiddleware({ tokenVerifier });

  return () => {
    return async (c, next) => {
      let passedAuth = false;
      await requireAuth(c, async () => {
        passedAuth = true;
      });

      if (!passedAuth) {
        return;
      }

      const auth = c.get("auth");
      if (!auth || !(await scopeChecker({ auth, context: c }))) {
        return c.json({ message: "forbidden" }, 403);
      }

      await next();
    };
  };
};

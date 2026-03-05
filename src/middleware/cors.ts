import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

const MIN_PORT = 1;
const MAX_PORT = 65535;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const parseOriginUrl = (origin: string): URL | null => {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin);
  } catch {
    return null;
  }
};

const isPortValid = (url: URL): boolean => {
  if (!url.port) {
    return true;
  }

  const port = Number(url.port);
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;
};

const isLocalhostOrigin = (url: URL): boolean => {
  return ALLOWED_PROTOCOLS.has(url.protocol) && LOCALHOST_HOSTNAMES.has(url.hostname) && isPortValid(url);
};

export const resolveLocalhostCorsOrigin = (origin: string): string | null => {
  const parsed = parseOriginUrl(origin);

  if (!parsed || !isLocalhostOrigin(parsed)) {
    return null;
  }

  return parsed.origin;
};

export const createLocalhostCorsMiddleware = (): MiddlewareHandler => {
  return cors({
    origin: (origin) => resolveLocalhostCorsOrigin(origin),
    credentials: true
  });
};

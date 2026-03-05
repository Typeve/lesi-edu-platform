import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import {
  createLocalhostCorsMiddleware,
  resolveLocalhostCorsOrigin
} from "../../src/middleware/cors.ts";

const createApp = () => {
  const app = new Hono();
  app.use("*", createLocalhostCorsMiddleware());
  app.get("/ping", (c) => c.json({ ok: true }));

  return app;
};

test("resolveLocalhostCorsOrigin should allow localhost origins", () => {
  const actualHttp = resolveLocalhostCorsOrigin("http://localhost:5173");
  const actualHttps = resolveLocalhostCorsOrigin("https://localhost:3000");
  const actualLoopback = resolveLocalhostCorsOrigin("http://127.0.0.1:8080");

  assert.equal(actualHttp, "http://localhost:5173");
  assert.equal(actualHttps, "https://localhost:3000");
  assert.equal(actualLoopback, "http://127.0.0.1:8080");
});

test("resolveLocalhostCorsOrigin should reject non-localhost origins", () => {
  const actualExternal = resolveLocalhostCorsOrigin("https://example.com");
  const actualMalformed = resolveLocalhostCorsOrigin("not-a-url");
  const actualEmpty = resolveLocalhostCorsOrigin("");

  assert.equal(actualExternal, null);
  assert.equal(actualMalformed, null);
  assert.equal(actualEmpty, null);
});

test("createLocalhostCorsMiddleware should set CORS headers for localhost origin", async () => {
  const app = createApp();
  const response = await app.request("/ping", {
    headers: {
      origin: "http://localhost:5173"
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});

test("createLocalhostCorsMiddleware should not set CORS headers for external origin", async () => {
  const app = createApp();
  const response = await app.request("/ping", {
    headers: {
      origin: "https://example.com"
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("createLocalhostCorsMiddleware should handle localhost preflight request", async () => {
  const app = createApp();
  const response = await app.request("/ping", {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:5173",
      "access-control-request-method": "GET"
    }
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(response.headers.get("access-control-allow-methods"), "GET,HEAD,PUT,POST,DELETE,PATCH");
});

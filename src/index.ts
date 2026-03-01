import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./config/env.js";
import { createAuthRoutes } from "./routes/auth.js";
import healthRoutes from "./routes/health.js";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    service: "lesi-edu-platform-api",
    status: "running"
  })
);

app.route("/", healthRoutes);
app.route("/auth", createAuthRoutes());

serve(
  {
    fetch: app.fetch,
    port: env.PORT
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);

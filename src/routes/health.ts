import { Hono } from "hono";
import { pool } from "../db/client.js";

const health = new Hono();

health.get("/health", async (c) => {
  try {
    await pool.query("SELECT 1");
    return c.json({
      ok: true,
      service: "lesi-edu-platform-api",
      database: "up"
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        service: "lesi-edu-platform-api",
        database: "down",
        message: error instanceof Error ? error.message : "unknown error"
      },
      500
    );
  }
});

export default health;


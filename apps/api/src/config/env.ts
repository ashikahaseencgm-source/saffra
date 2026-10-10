import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";

// Load .env from the monorepo root regardless of cwd.
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config(); // also allow a local apps/api/.env to override

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default(process.env.VERCEL ? "file:/tmp/dev.db" : "file:./dev.db"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Absolute path to the built frontend (apps/web/dist) to serve statically.
  // Unset in monorepo dev (defaults to ../../web/dist); the Electron main
  // process sets this to wherever it bundled the frontend inside the
  // packaged app.
  WEB_DIST_PATH: z.string().optional().default(""),
  // Also serve on this port so the Wi-Fi address needs no ":4000"
  // (http://<name>.local). 0 = off. Defaults to 80 in production (the
  // desktop app), off in dev. Skipped quietly if the port is taken.
  FRIENDLY_PORT: z.coerce.number().int().min(0).max(65535).optional(),
  // Set to "false" to stop announcing http://<name>.local on the network.
  LOCAL_NAME_ENABLED: z.enum(["true", "false"]).default("true"),

  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-me-please-32chars"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change-me-please-32chars"),
  // Encrypts secrets stored in the database (e.g. the restaurant's Razorpay
  // key secret). Optional: falls back to a key derived from JWT_REFRESH_SECRET.
  DATA_ENCRYPTION_KEY: z.string().optional().default(""),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  RAZORPAY_MODE: z.enum(["test", "live"]).default("test"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = {
  ...parsed.data,
  FRIENDLY_PORT: parsed.data.FRIENDLY_PORT ?? (parsed.data.NODE_ENV === "production" ? 80 : 0),
};


import fs from "node:fs";
import path from "node:path";
import { createApp } from "../apps/api/dist/app.js";

// Ensure SQLite database exists in writable /tmp directory on Vercel
if (process.env.VERCEL) {
  const tmpDbPath = "/tmp/dev.db";
  if (!fs.existsSync(tmpDbPath)) {
    const candidatePaths = [
      path.resolve(process.cwd(), "apps/api/prisma/dev.db"),
      path.resolve(process.cwd(), "prisma/dev.db"),
      path.resolve(process.cwd(), "dev.db"),
    ];
    for (const srcPath of candidatePaths) {
      if (fs.existsSync(srcPath)) {
        try {
          fs.copyFileSync(srcPath, tmpDbPath);
          break;
        } catch (err) {
          console.error("Failed to copy dev.db to /tmp:", err);
        }
      }
    }
  }
  process.env.DATABASE_URL = `file:${tmpDbPath}`;
}

const app = createApp();

export default function handler(req, res) {
  // If the request was rewritten without /api, restore it so Express route handlers match
  if (!req.url.startsWith("/api") && !req.url.startsWith("/health")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}

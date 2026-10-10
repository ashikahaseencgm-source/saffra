import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";
import { findNearestAncestorWith } from "./paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Applies any not-yet-applied migrations from prisma/migrations, using the
 * same `_prisma_migrations` bookkeeping table the `prisma migrate` CLI
 * itself writes to — so this stays interchangeable with running the real
 * CLI (e.g. during local dev with `npm run db:migrate`) rather than
 * inventing a second, incompatible tracking mechanism.
 *
 * This exists because the packaged desktop app has no shell access to run
 * `prisma migrate deploy` against a brand-new user's SQLite file — it has
 * to happen in-process, on every boot, using the same PrismaClient the app
 * already needs for everything else. It's idempotent and safe to call on
 * every startup, dev or packaged.
 */
export async function runMigrations(): Promise<void> {
  const apiRoot = findNearestAncestorWith(__dirname, path.join("prisma", "migrations"));
  if (!apiRoot) {
    logger.warn("No prisma/migrations directory found near the running server — skipping migrations.");
    return;
  }
  const migrationsDir = path.join(apiRoot, "prisma", "migrations");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    TEXT PRIMARY KEY NOT NULL,
        "checksum"              TEXT NOT NULL,
        "finished_at"           DATETIME,
        "migration_name"        TEXT NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        DATETIME,
        "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
    )
  `);

  const appliedRows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  const applied = new Set(appliedRows.map((r) => r.migration_name));

  const folders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  for (const folder of folders) {
    if (applied.has(folder)) continue;

    const sqlPath = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    const sql = fs.readFileSync(sqlPath, "utf-8");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !/^begin$/i.test(s) && !/^commit$/i.test(s));

    logger.info(`Applying database migration ${folder} (${statements.length} statement(s))...`);
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      checksum,
      new Date().toISOString(),
      folder,
      statements.length,
    );
  }
}

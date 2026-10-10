import fs from "node:fs";
import path from "node:path";

/**
 * Walks upward from `startDir` looking for a directory that contains
 * `markerRelativePath`. This is deliberately NOT a fixed number of `../`
 * segments — tsup bundles everything under src/ into one flat dist/server.js,
 * so "how many levels up is apps/api/ from here" differs between running
 * from source (e.g. src/lib/foo.ts, two levels down) and running the built
 * bundle (dist/server.js, one level down). A fixed relative path is correct
 * for exactly one of those and silently wrong for the other.
 */
export function findNearestAncestorWith(startDir: string, markerRelativePath: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, markerRelativePath))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

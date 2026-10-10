import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/app.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  // @saffra/types and @saffra/config are workspace packages whose "main"
  // points straight at raw .ts source (fine for tsx/Vite's TS loaders, but
  // plain `node dist/server.js` can't import a .ts file at all). Without
  // this, esbuild's default "externalize anything under node_modules"
  // heuristic leaves a runtime `import "@saffra/types"` in the bundle
  // instead of inlining it, which only breaks once you actually run the
  // built output outside a TS-aware runtime — exactly the packaged/Electron
  // case this needs to work for.
  noExternal: [/^@saffra\//],
});

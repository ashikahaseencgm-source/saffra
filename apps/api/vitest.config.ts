import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      { find: "@saffra/types", replacement: path.resolve(__dirname, "../../packages/types/src/index.ts") },
      { find: "@saffra/config", replacement: path.resolve(__dirname, "../../packages/config/src/index.ts") },
    ],
  },
});

import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initSocketGateway } from "./lib/socket.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./lib/migrate.js";
import { startLocalNameResponder } from "./lib/localName.js";
import { networkState } from "./lib/networkState.js";
import { refreshLocalHostname } from "./modules/settings/settings.service.js";

async function main() {
  // Idempotent — safe on every boot, dev or packaged. This is what lets a
  // brand-new install (or one updated to a newer schema) end up with a
  // correct, up-to-date SQLite database with no manual step and no shell
  // access to the `prisma` CLI.
  await runMigrations();

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocketGateway(httpServer);

  // No host argument = listens on all network interfaces (0.0.0.0), which
  // is what makes Saffra reachable from other devices on the restaurant's
  // Wi-Fi, not just this machine.
  httpServer.listen(env.PORT, () => {
    logger.info(`Saffra API listening on port ${env.PORT} (${env.NODE_ENV})`);
    // Lets the Electron main process (which forks this file as a child
    // process) know exactly when it's safe to load the window instead of
    // guessing with a fixed delay or polling /health in a loop.
    process.send?.({ type: "ready", port: env.PORT });
  });

  // Friendly Wi-Fi access (all optional — the numeric address always works):
  // http://<restaurant-name>.local, and no ":4000" when port 80 is free.
  if (env.LOCAL_NAME_ENABLED === "true" && startLocalNameResponder()) {
    await refreshLocalHostname().catch((err) => logger.warn("Couldn't read the restaurant name for the Wi-Fi address", err));
  }
  if (env.FRIENDLY_PORT && env.FRIENDLY_PORT !== env.PORT) {
    const friendlyServer = http.createServer(app);
    friendlyServer.on("error", (err: NodeJS.ErrnoException) => {
      logger.warn(`Port ${env.FRIENDLY_PORT} isn't available (${err.code}); staff will use port ${env.PORT} instead.`);
    });
    friendlyServer.listen(env.FRIENDLY_PORT, () => {
      initSocketGateway(friendlyServer);
      networkState.friendlyPort = env.FRIENDLY_PORT;
      logger.info(`Also serving on port ${env.FRIENDLY_PORT}`);
    });
  }
}

main().catch((err) => {
  logger.error("Fatal startup error", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});

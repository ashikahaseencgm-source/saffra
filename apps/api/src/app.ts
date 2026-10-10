import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { apiRateLimiter } from "./middleware/rateLimit.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { findNearestAncestorWith } from "./lib/paths.js";

import authRoutes from "./modules/auth/auth.routes.js";
import tablesRoutes from "./modules/tables/tables.routes.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import ordersRoutes from "./modules/orders/orders.routes.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";
import kitchenRoutes from "./modules/kitchen/kitchen.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import staffRoutes from "./modules/staff/staff.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import receiptsRoutes from "./modules/receipts/receipts.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";
import customersRoutes from "./modules/customers/customers.routes.js";
import publicPayRoutes from "./modules/publicPay/publicPay.routes.js";
import setupRoutes from "./modules/setup/setup.routes.js";
import loyaltyRoutes from "./modules/loyalty/loyalty.routes.js";
import { guestRouter, guestRequestsRouter } from "./modules/guestOrdering/guestOrdering.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Where the built frontend (apps/web/dist) lives. Saffra serves the API and
// the SPA from a single Express server on one port — that's what lets a
// waiter's phone just open http://<host-ip>:<port> on the restaurant Wi-Fi
// and get the whole app, no separate web server, no cloud, no CORS. The
// desktop (Electron) build points WEB_DIST_PATH at wherever it bundled the
// frontend; local `npm run build` + `npm start` in this monorepo finds its
// sibling apps/web/dist by walking up from wherever this is actually
// running (source vs. tsup's bundled dist/server.js sit at different
// depths, so a fixed number of `../` segments isn't reliable — see
// findNearestAncestorWith).
const apiPackageRoot = findNearestAncestorWith(__dirname, path.join("..", "web", "dist"));
const webDistPath = env.WEB_DIST_PATH || (apiPackageRoot ? path.join(apiPackageRoot, "..", "web", "dist") : "");
const webIndexHtml = webDistPath ? path.join(webDistPath, "index.html") : "";
const hasWebBuild = !!webIndexHtml && fs.existsSync(webIndexHtml);

export function createApp() {
  const app = express();

  app.use(
    helmet({
      // Saffra is a single-tenant local app, not a public multi-origin site —
      // the default CSP fights the Vite-built SPA (blob: receipt downloads,
      // data: URIs) for no real benefit here, so it's off; helmet's other
      // protections (frameguard, noSniff, etc.) still apply.
      contentSecurityPolicy: false,
    }),
  );
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "saffra-api", time: new Date().toISOString() }));

  const api = express.Router();
  api.use(apiRateLimiter);
  api.use("/auth", authRoutes);
  api.use("/tables", tablesRoutes);
  api.use("/menu", menuRoutes);
  api.use("/orders", ordersRoutes);
  api.use("/payments", paymentsRoutes);
  api.use("/kitchen", kitchenRoutes);
  api.use("/reports", reportsRoutes);
  api.use("/staff", staffRoutes);
  api.use("/settings", settingsRoutes);
  api.use("/receipts", receiptsRoutes);
  api.use("/audit", auditRoutes);
  api.use("/customers", customersRoutes);
  api.use("/pay", publicPayRoutes);
  api.use("/setup", setupRoutes);
  api.use("/loyalty", loyaltyRoutes);
  api.use("/guest", guestRouter);
  api.use("/guest-requests", guestRequestsRouter);
  api.use(notFoundHandler);
  app.use("/api", api);

  if (hasWebBuild) {
    app.use(express.static(webDistPath, { index: false }));
    // SPA fallback: any other GET (a client-side route like /tables, or a
    // hard refresh on one) serves index.html so React Router can take over.
    app.get(/^(?!\/api|\/health|\/socket\.io).*/, (_req, res) => {
      res.sendFile(webIndexHtml);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { authRateLimiter } from "../../middleware/rateLimit.js";
import { getStatusHandler, getNetworkInfoHandler, completeSetupHandler } from "./setup.controller.js";
import { completeSetupSchema } from "./setup.schema.js";

// Intentionally NOT behind requireAuth — onboarding runs before any staff
// account exists. completeSetup is itself the guard: it refuses once a
// restaurant has already finished setup, so this can't be replayed to
// tamper with a live installation. network-info is harmless to expose
// unauthenticated too (it's shown right there on the LAN screen for staff
// to read off, and it only reveals this machine's own local IP).
const router = Router();
router.get("/status", getStatusHandler);
router.get("/network-info", getNetworkInfoHandler);
router.post("/complete", authRateLimiter, validate(completeSetupSchema), completeSetupHandler);

export default router;

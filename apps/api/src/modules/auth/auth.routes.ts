import { Router } from "express";
import { loginHandler, refreshHandler, logoutHandler, meHandler, completeTourHandler } from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { loginSchema, refreshSchema } from "./auth.schema.js";
import { requireAuth } from "../../middleware/auth.js";
import { authRateLimiter } from "../../middleware/rateLimit.js";

const router = Router();

router.post("/login", authRateLimiter, validate(loginSchema), loginHandler);
router.post("/refresh", validate(refreshSchema), refreshHandler);
router.post("/logout", validate(refreshSchema), logoutHandler);
router.get("/me", requireAuth, meHandler);
router.post("/complete-tour", requireAuth, completeTourHandler);

export default router;

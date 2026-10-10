import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { publicPayRateLimiter } from "../../middleware/rateLimit.js";
import { getSummaryHandler, createHandler, demoProcessHandler, verifyHandler, receiptPdfHandler } from "./publicPay.controller.js";
import { publicDemoProcessSchema, publicVerifySchema } from "./publicPay.schema.js";

// Intentionally NOT behind requireAuth — this is the customer-facing,
// unauthenticated surface. Every handler resolves and validates the
// :token param itself instead of trusting a JWT.
const router = Router();
router.use(publicPayRateLimiter);

router.get("/:token", getSummaryHandler);
router.post("/:token/create", createHandler);
router.post("/:token/demo/process", validate(publicDemoProcessSchema), demoProcessHandler);
router.post("/:token/verify", validate(publicVerifySchema), verifyHandler);
router.get("/:token/receipt.pdf", receiptPdfHandler);

export default router;

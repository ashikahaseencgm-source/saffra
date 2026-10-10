import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import {
  createPaymentHandler,
  demoProcessHandler,
  verifyPaymentHandler,
  cashPaymentHandler,
  refundPaymentHandler,
  getPaymentHandler,
  cancelPendingForReorderHandler,
} from "./payments.controller.js";
import {
  createPaymentSchema,
  demoProcessSchema,
  verifyPaymentSchema,
  cashPaymentSchema,
  refundPaymentSchema,
} from "./payments.schema.js";

const router = Router();
router.use(requireAuth);

router.post("/create", requireRole(...ROLE_GROUPS.all), validate(createPaymentSchema), createPaymentHandler);
router.post("/verify", requireRole(...ROLE_GROUPS.all), validate(verifyPaymentSchema), verifyPaymentHandler);
router.post("/demo/process", requireRole(...ROLE_GROUPS.all), validate(demoProcessSchema), demoProcessHandler);
router.post("/cash", requireRole(...ROLE_GROUPS.billingStaff), validate(cashPaymentSchema), cashPaymentHandler);
router.post("/refund", requireRole(...ROLE_GROUPS.management), validate(refundPaymentSchema), refundPaymentHandler);
router.post("/cancel-pending", requireRole(...ROLE_GROUPS.all), validate(createPaymentSchema), cancelPendingForReorderHandler);
router.get("/:id", getPaymentHandler);

export default router;

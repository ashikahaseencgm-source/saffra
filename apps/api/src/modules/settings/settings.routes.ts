import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import {
  getSettingsHandler,
  updateSettingsHandler,
  getPaymentGatewayHandler,
  savePaymentGatewayHandler,
  recheckPaymentGatewayHandler,
  removePaymentGatewayHandler,
} from "./settings.controller.js";
import { savePaymentGatewaySchema, updateSettingsSchema } from "./settings.schema.js";

const router = Router();

// GET is unauthenticated on purpose: the frontend reads payment-provider
// status (Demo vs Razorpay) before login to decide whether to preload
// checkout.js, and the login screen shows the restaurant name/logo.
router.get("/", getSettingsHandler);
// The restaurant's own Razorpay account. Managers can see the status; only an
// admin can change where the restaurant's money goes.
router.get("/payment-gateway", requireAuth, requireRole(...ROLE_GROUPS.management), getPaymentGatewayHandler);
router.put("/payment-gateway", requireAuth, requireRole(...ROLE_GROUPS.adminOnly), validate(savePaymentGatewaySchema), savePaymentGatewayHandler);
router.post("/payment-gateway/check", requireAuth, requireRole(...ROLE_GROUPS.management), recheckPaymentGatewayHandler);
router.delete("/payment-gateway", requireAuth, requireRole(...ROLE_GROUPS.adminOnly), removePaymentGatewayHandler);
router.patch("/", requireAuth, requireRole(...ROLE_GROUPS.management), validate(updateSettingsSchema), updateSettingsHandler);

export default router;

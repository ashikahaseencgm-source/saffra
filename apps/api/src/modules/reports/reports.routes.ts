import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import {
  dashboardHandler,
  revenueHandler,
  topItemsHandler,
  waiterPerformanceHandler,
  paymentBreakdownHandler,
  tableUtilizationHandler,
} from "./reports.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/dashboard", dashboardHandler);
router.get("/revenue", requireRole(...ROLE_GROUPS.management), revenueHandler);
router.get("/items", requireRole(...ROLE_GROUPS.management), topItemsHandler);
router.get("/waiters", requireRole(...ROLE_GROUPS.management), waiterPerformanceHandler);
router.get("/payments", requireRole(...ROLE_GROUPS.management), paymentBreakdownHandler);
router.get("/tables", requireRole(...ROLE_GROUPS.management), tableUtilizationHandler);

export default router;

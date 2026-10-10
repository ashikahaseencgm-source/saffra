import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { listAuditLogs } from "./auditService.js";

const router = Router();
router.use(requireAuth, requireRole(...ROLE_GROUPS.management));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    res.json(await listAuditLogs(limit));
  }),
);

export default router;

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import {
  listStaffHandler,
  getStaffHandler,
  createStaffHandler,
  updateStaffHandler,
  resetPasswordHandler,
  deactivateStaffHandler,
} from "./staff.controller.js";
import { createStaffSchema, updateStaffSchema, resetPasswordSchema } from "./staff.schema.js";

const router = Router();
router.use(requireAuth, requireRole(...ROLE_GROUPS.management));

router.get("/", listStaffHandler);
router.get("/:id", getStaffHandler);
router.post("/", validate(createStaffSchema), createStaffHandler);
router.patch("/:id", validate(updateStaffSchema), updateStaffHandler);
router.post("/:id/reset-password", validate(resetPasswordSchema), resetPasswordHandler);
router.delete("/:id", deactivateStaffHandler);

export default router;

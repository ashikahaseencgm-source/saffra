import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import {
  listTablesHandler,
  getTableHandler,
  updateTableStatusHandler,
  createTableHandler,
  updateTableHandler,
  deleteTableHandler,
} from "./tables.controller.js";
import { updateTableStatusSchema, createTableSchema, updateTableSchema } from "./tables.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", listTablesHandler);
router.get("/:id", getTableHandler);
router.patch("/:id/status", requireRole(...ROLE_GROUPS.all), validate(updateTableStatusSchema), updateTableStatusHandler);

router.post("/", requireRole(...ROLE_GROUPS.management), validate(createTableSchema), createTableHandler);
router.patch("/:id", requireRole(...ROLE_GROUPS.management), validate(updateTableSchema), updateTableHandler);
router.delete("/:id", requireRole(...ROLE_GROUPS.management), deleteTableHandler);

export default router;

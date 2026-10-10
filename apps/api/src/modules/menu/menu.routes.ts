import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import {
  listMenuItemsHandler,
  listCategoriesHandler,
  createCategoryHandler,
  getMenuItemHandler,
  createMenuItemHandler,
  updateMenuItemHandler,
  deleteMenuItemHandler,
} from "./menu.controller.js";
import { createMenuItemSchema, updateMenuItemSchema, menuQuerySchema, createCategorySchema } from "./menu.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(menuQuerySchema, "query"), listMenuItemsHandler);
router.get("/categories", listCategoriesHandler);
router.post("/categories", requireRole(...ROLE_GROUPS.management), validate(createCategorySchema), createCategoryHandler);
router.get("/:id", getMenuItemHandler);
router.post("/", requireRole(...ROLE_GROUPS.management), validate(createMenuItemSchema), createMenuItemHandler);
router.patch("/:id", requireRole(...ROLE_GROUPS.management), validate(updateMenuItemSchema), updateMenuItemHandler);
router.delete("/:id", requireRole(...ROLE_GROUPS.management), deleteMenuItemHandler);

export default router;

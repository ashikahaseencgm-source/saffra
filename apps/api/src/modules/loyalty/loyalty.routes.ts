import { Router, type Request, type Response } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as loyalty from "./loyalty.service.js";
import { applyPointsSchema, loyaltyProgramSchema } from "./loyalty.schema.js";

const router = Router();
router.use(requireAuth);

// Everyone needs to read the rules (bill screen shows "earns X points").
router.get("/program", asyncHandler(async (req: Request, res: Response) => {
  res.json(await loyalty.getLoyaltyConfig(req.user!.restaurantId));
}));
router.put("/program", requireRole(...ROLE_GROUPS.management), validate(loyaltyProgramSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json(await loyalty.updateLoyaltyConfig(req.user!.restaurantId, req.body, req.user!.sub));
}));
router.get("/members", requireRole(...ROLE_GROUPS.management), asyncHandler(async (req: Request, res: Response) => {
  res.json(await loyalty.listMembers(req.user!.restaurantId));
}));
router.get("/customers/:id", asyncHandler(async (req: Request, res: Response) => {
  res.json(await loyalty.getCustomerLoyalty(req.params.id!));
}));
router.get("/orders/:id", asyncHandler(async (req: Request, res: Response) => {
  res.json(await loyalty.getOrderLoyalty(req.params.id!));
}));
router.post("/orders/:id/points", requireRole(...ROLE_GROUPS.all), validate(applyPointsSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json(await loyalty.applyPoints(req.params.id!, req.body.points, req.user!.sub));
}));

export default router;

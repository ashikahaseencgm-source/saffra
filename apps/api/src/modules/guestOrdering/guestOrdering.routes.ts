import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as guest from "./guestOrdering.service.js";
import { declineRequestSchema, guestRequestSchema } from "./guestOrdering.schema.js";

// Public, unauthenticated: the guest's phone after scanning a table QR code.
// Every route resolves its own table from the :token — never from a login.
export const guestRouter = Router();
guestRouter.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 90, // the status screen polls every few seconds
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait a moment." } },
  }),
);
guestRouter.get("/:token", asyncHandler(async (req: Request, res: Response) => {
  res.json(await guest.getGuestMenu(req.params.token!));
}));
guestRouter.get("/:token/status", asyncHandler(async (req: Request, res: Response) => {
  res.json(await guest.getGuestStatus(req.params.token!));
}));
guestRouter.post("/:token/requests", validate(guestRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await guest.createGuestOrderRequest(req.params.token!, req.body));
}));
guestRouter.post("/:token/bill", asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await guest.requestBill(req.params.token!));
}));

// Staff: incoming guest requests + table QR codes.
export const guestRequestsRouter = Router();
guestRequestsRouter.use(requireAuth);
guestRequestsRouter.get("/", asyncHandler(async (req: Request, res: Response) => {
  res.json(await guest.listPendingRequests(req.user!.restaurantId));
}));
guestRequestsRouter.post("/:id/accept", requireRole(...ROLE_GROUPS.all), asyncHandler(async (req: Request, res: Response) => {
  res.json(await guest.acceptRequest(req.params.id!, req.user!.restaurantId, req.user!.sub));
}));
guestRequestsRouter.post("/:id/decline", requireRole(...ROLE_GROUPS.all), validate(declineRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json(await guest.declineRequest(req.params.id!, req.user!.restaurantId, req.user!.sub, req.body.reason));
}));
guestRequestsRouter.get("/table-qr-codes", requireRole(...ROLE_GROUPS.management), asyncHandler(async (req: Request, res: Response) => {
  res.json(await guest.listTableQrCodes(req.user!.restaurantId));
}));
guestRequestsRouter.post("/table-qr-codes/:tableId/regenerate", requireRole(...ROLE_GROUPS.management), asyncHandler(async (req: Request, res: Response) => {
  res.json(await guest.regenerateTableQr(req.params.tableId!, req.user!.sub));
}));

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { listTicketsHandler, advanceTicketHandler, recallTicketHandler } from "./kitchen.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/tickets", listTicketsHandler);
router.post("/tickets/:id/advance", advanceTicketHandler);
router.post("/tickets/:id/recall", recallTicketHandler);

export default router;

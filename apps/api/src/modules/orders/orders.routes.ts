import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import {
  listOrdersHandler,
  getOrderHandler,
  createOrderHandler,
  updateOrderHandler,
  addOrderItemHandler,
  updateOrderItemHandler,
  deleteOrderItemHandler,
  applyDiscountHandler,
  confirmOrderHandler,
  sendToKitchenHandler,
  markServedHandler,
  completeOrderHandler,
  cancelOrderHandler,
  createPaymentLinkHandler,
} from "./orders.controller.js";
import {
  createOrderSchema,
  updateOrderSchema,
  addOrderItemSchema,
  updateOrderItemSchema,
  applyDiscountSchema,
  orderQuerySchema,
} from "./orders.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(orderQuerySchema, "query"), listOrdersHandler);
router.post("/", requireRole(...ROLE_GROUPS.all), validate(createOrderSchema), createOrderHandler);
router.get("/:id", getOrderHandler);
router.patch("/:id", requireRole(...ROLE_GROUPS.all), validate(updateOrderSchema), updateOrderHandler);

router.post("/:id/items", requireRole(...ROLE_GROUPS.all), validate(addOrderItemSchema), addOrderItemHandler);
router.patch("/:id/items/:itemId", requireRole(...ROLE_GROUPS.all), validate(updateOrderItemSchema), updateOrderItemHandler);
router.delete("/:id/items/:itemId", requireRole(...ROLE_GROUPS.all), deleteOrderItemHandler);

router.post("/:id/discount", requireRole(...ROLE_GROUPS.management), validate(applyDiscountSchema), applyDiscountHandler);

router.post("/:id/confirm", requireRole(...ROLE_GROUPS.all), confirmOrderHandler);
router.post("/:id/send-kitchen", requireRole(...ROLE_GROUPS.all), sendToKitchenHandler);
router.post("/:id/serve", requireRole(...ROLE_GROUPS.all), markServedHandler);
router.post("/:id/complete", requireRole(...ROLE_GROUPS.all), completeOrderHandler);
router.post("/:id/cancel", requireRole(...ROLE_GROUPS.all), cancelOrderHandler);
router.post("/:id/payment-link", requireRole(...ROLE_GROUPS.all), createPaymentLinkHandler);

export default router;

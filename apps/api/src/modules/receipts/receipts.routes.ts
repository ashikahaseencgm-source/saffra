import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getReceiptHtml, getReceiptPdf } from "./receiptService.js";
import { prisma } from "../../lib/prisma.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/:orderId/html",
  asyncHandler(async (req, res) => {
    const html = await getReceiptHtml(req.params.orderId!);
    res.type("html").send(html);
  }),
);

router.get(
  "/:orderId/pdf",
  asyncHandler(async (req, res) => {
    const buffer = await getReceiptPdf(req.params.orderId!);
    res.type("pdf").setHeader("Content-Disposition", `inline; filename="receipt-${req.params.orderId}.pdf"`);
    res.send(buffer);
  }),
);

router.post(
  "/:orderId/reprint",
  asyncHandler(async (req, res) => {
    await prisma.receipt.update({ where: { orderId: req.params.orderId }, data: { printCount: { increment: 1 } } });
    res.status(204).send();
  }),
);

export default router;

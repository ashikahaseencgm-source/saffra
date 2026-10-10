import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as publicPayService from "./publicPay.service.js";
import * as paymentsService from "../payments/payments.service.js";
import { getReceiptPdf } from "../receipts/receiptService.js";

export const getSummaryHandler = asyncHandler(async (req: Request, res: Response) => {
  const summary = await publicPayService.getPublicOrderSummary(req.params.token!);
  res.json(summary);
});

export const createHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = await publicPayService.assertTokenIsPayable(req.params.token!);
  const result = await paymentsService.createPayment(orderId, null);
  res.status(201).json(result);
});

export const demoProcessHandler = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId, method, outcome } = req.body;
  await publicPayService.assertPaymentBelongsToToken(req.params.token!, paymentId);
  const result = await paymentsService.processDemoPayment(paymentId, method, outcome, null);
  res.json(result);
});

export const verifyHandler = asyncHandler(async (req: Request, res: Response) => {
  await publicPayService.assertPaymentBelongsToToken(req.params.token!, req.body.paymentId);
  const result = await paymentsService.verifyPayment(req.body, null);
  res.json(result);
});

export const receiptPdfHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = await publicPayService.getOrderIdForToken(req.params.token!);
  const buffer = await getReceiptPdf(orderId);
  res.type("pdf").setHeader("Content-Disposition", `attachment; filename="receipt-${orderId}.pdf"`);
  res.send(buffer);
});

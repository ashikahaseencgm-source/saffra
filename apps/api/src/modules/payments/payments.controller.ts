import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as paymentsService from "./payments.service.js";

export const createPaymentHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentsService.createPayment(req.body.orderId, req.user!.sub);
  res.status(201).json(result);
});

export const demoProcessHandler = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId, method, outcome } = req.body;
  const result = await paymentsService.processDemoPayment(paymentId, method, outcome, req.user!.sub);
  res.json(result);
});

export const verifyPaymentHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentsService.verifyPayment(req.body, req.user!.sub);
  res.json(result);
});

export const cashPaymentHandler = asyncHandler(async (req: Request, res: Response) => {
  const { orderId, amountReceived } = req.body;
  const result = await paymentsService.processCashPayment(orderId, amountReceived, req.user!.sub);
  res.json(result);
});

export const refundPaymentHandler = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId, amount } = req.body;
  const result = await paymentsService.refundPayment(paymentId, amount, req.user!.sub);
  res.json(result);
});

export const getPaymentHandler = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentsService.getPayment(req.params.id!);
  res.json(payment);
});

export const cancelPendingForReorderHandler = asyncHandler(async (req: Request, res: Response) => {
  await paymentsService.cancelPendingPaymentForReorder(req.body.orderId, req.user!.sub);
  res.status(204).send();
});

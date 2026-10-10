import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as settingsService from "./settings.service.js";
import * as gatewayService from "./paymentGateway.service.js";

export const getSettingsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await settingsService.getSettings());
});

export const getPaymentGatewayHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await gatewayService.getPaymentGatewayStatus());
});

export const savePaymentGatewayHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await gatewayService.savePaymentGateway(req.user!.restaurantId, req.body, req.user!.sub));
});

export const recheckPaymentGatewayHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await gatewayService.recheckPaymentGateway(req.user!.restaurantId));
});

export const removePaymentGatewayHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await gatewayService.removePaymentGateway(req.user!.restaurantId, req.user!.sub));
});

export const updateSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await settingsService.updateSettings(req.user!.restaurantId, req.body));
});

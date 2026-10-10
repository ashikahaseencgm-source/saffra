import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as setupService from "./setup.service.js";

export const getStatusHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await setupService.getSetupStatus());
});

export const getNetworkInfoHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json(setupService.getNetworkInfo());
});

export const completeSetupHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await setupService.completeSetup(req.body, {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  res.status(201).json(result);
});

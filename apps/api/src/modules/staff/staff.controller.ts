import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as staffService from "./staff.service.js";

export const listStaffHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffService.listStaff(req.user!.restaurantId));
});

export const getStaffHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffService.getStaff(req.params.id!));
});

export const createStaffHandler = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.createStaff(req.user!.restaurantId, req.body, req.user!.sub);
  res.status(201).json(staff);
});

export const updateStaffHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffService.updateStaff(req.params.id!, req.body, req.user!.sub));
});

export const resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  await staffService.resetPassword(req.params.id!, req.body.password, req.user!.sub);
  res.status(204).send();
});

export const deactivateStaffHandler = asyncHandler(async (req: Request, res: Response) => {
  await staffService.deactivateStaff(req.params.id!, req.user!.sub);
  res.status(204).send();
});

import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/errors.js";

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, password } = req.body;
  const result = await authService.login(employeeId, password, {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  res.json(result);
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.refresh(refreshToken);
  res.json(result);
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) await authService.logout(refreshToken);
  res.status(204).send();
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const user = await authService.getMe(req.user.sub);
  res.json(user);
});

export const completeTourHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const user = await authService.completeTour(req.user.sub);
  res.json(user);
});

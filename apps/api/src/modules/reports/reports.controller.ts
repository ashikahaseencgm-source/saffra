import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as reportsService from "./reports.service.js";

export const dashboardHandler = asyncHandler(async (req: Request, res: Response) => {
  const stats = await reportsService.getDashboardStats(req.user!.restaurantId);
  res.json(stats);
});

export const revenueHandler = asyncHandler(async (req: Request, res: Response) => {
  const { range = "week", from, to } = req.query as Record<string, string>;
  const now = new Date();
  let start: Date;
  let bucket: "day" | "week" | "month" = "day";

  if (from && to) {
    start = new Date(from);
  } else if (range === "day") {
    start = new Date(now);
    start.setDate(start.getDate() - 1);
  } else if (range === "month") {
    start = new Date(now);
    start.setMonth(start.getMonth() - 1);
  } else if (range === "year") {
    start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    bucket = "month";
  } else {
    start = new Date(now);
    start.setDate(start.getDate() - 7);
  }

  const end = to ? new Date(to) : now;
  const data = await reportsService.getRevenueReport(req.user!.restaurantId, start, end, bucket);
  res.json(data);
});

export const topItemsHandler = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const data = await reportsService.getTopItems(req.user!.restaurantId, limit);
  res.json(data);
});

export const waiterPerformanceHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await reportsService.getWaiterPerformance(req.user!.restaurantId);
  res.json(data);
});

export const paymentBreakdownHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await reportsService.getPaymentBreakdown(req.user!.restaurantId);
  res.json(data);
});

export const tableUtilizationHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await reportsService.getTableUtilization(req.user!.restaurantId);
  res.json(data);
});

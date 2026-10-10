import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as tablesService from "./tables.service.js";
import { AppError } from "../../lib/errors.js";

export const listTablesHandler = asyncHandler(async (req: Request, res: Response) => {
  const tables = await tablesService.listTables(req.user!.restaurantId);
  res.json(tables);
});

export const getTableHandler = asyncHandler(async (req: Request, res: Response) => {
  const table = await tablesService.getTable(req.params.id!);
  res.json(table);
});

export const updateTableStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const table = await tablesService.updateTableStatus(req.params.id!, req.body.status, req.user.sub);
  res.json(table);
});

export const createTableHandler = asyncHandler(async (req: Request, res: Response) => {
  const table = await tablesService.createTable(req.user!.restaurantId, req.body.number, req.body.capacity);
  res.status(201).json(table);
});

export const updateTableHandler = asyncHandler(async (req: Request, res: Response) => {
  const table = await tablesService.updateTable(req.params.id!, req.body);
  res.json(table);
});

export const deleteTableHandler = asyncHandler(async (req: Request, res: Response) => {
  await tablesService.softDeleteTable(req.params.id!);
  res.status(204).send();
});

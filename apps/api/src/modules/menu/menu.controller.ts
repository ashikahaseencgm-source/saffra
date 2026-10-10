import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as menuService from "./menu.service.js";

export const listMenuItemsHandler = asyncHandler(async (req: Request, res: Response) => {
  const items = await menuService.listMenuItems(req.user!.restaurantId, req.query as any);
  res.json(items);
});

export const listCategoriesHandler = asyncHandler(async (req: Request, res: Response) => {
  const categories = await menuService.listCategories(req.user!.restaurantId);
  res.json(categories);
});

export const createCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const category = await menuService.createCategory(req.user!.restaurantId, req.body.name, req.body.sortOrder);
  res.status(201).json(category);
});

export const getMenuItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const item = await menuService.getMenuItem(req.params.id!);
  res.json(item);
});

export const createMenuItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const item = await menuService.createMenuItem(req.user!.restaurantId, req.body);
  res.status(201).json(item);
});

export const updateMenuItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const item = await menuService.updateMenuItem(req.params.id!, req.body);
  res.json(item);
});

export const deleteMenuItemHandler = asyncHandler(async (req: Request, res: Response) => {
  await menuService.deleteMenuItem(req.params.id!);
  res.status(204).send();
});

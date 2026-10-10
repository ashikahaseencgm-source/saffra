import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as customersService from "./customers.service.js";

export const lookupCustomerHandler = asyncHandler(async (req: Request, res: Response) => {
  const phone = req.query.phone as string;
  const result = await customersService.lookupCustomer(req.user!.restaurantId, phone);
  res.json(result);
});

export const createCustomerHandler = asyncHandler(async (req: Request, res: Response) => {
  const { phone, name } = req.body;
  const customer = await customersService.createCustomer(req.user!.restaurantId, phone, name);
  res.status(201).json(customer);
});

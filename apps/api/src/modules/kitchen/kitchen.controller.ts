import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as kitchenService from "./kitchen.service.js";

export const listTicketsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tickets = await kitchenService.listActiveTickets(req.user!.restaurantId);
  res.json(tickets);
});

export const advanceTicketHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await kitchenService.advanceTicket(req.params.id!, req.user!.sub);
  res.json(ticket);
});

export const recallTicketHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await kitchenService.recallTicket(req.params.id!, req.user!.sub);
  res.json(ticket);
});

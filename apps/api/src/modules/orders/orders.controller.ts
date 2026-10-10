import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as ordersService from "./orders.service.js";

export const listOrdersHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as any;
  const result = await ordersService.listOrders(req.user!.restaurantId, q);
  res.json(result);
});

export const getOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.getOrder(req.params.id!);
  res.json(order);
});

export const createOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.createOrder(req.user!.restaurantId, req.user!.sub, req.body);
  res.status(201).json(order);
});

export const updateOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.updateOrder(req.params.id!, req.body);
  res.json(order);
});

export const addOrderItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.addOrderItem(req.params.id!, req.body, req.user!.sub);
  res.status(201).json(order);
});

export const updateOrderItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.updateOrderItem(req.params.id!, req.params.itemId!, req.body, req.user!.sub);
  res.json(order);
});

export const deleteOrderItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.removeOrderItem(req.params.id!, req.params.itemId!, req.user!.sub);
  res.json(order);
});

export const applyDiscountHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.applyDiscount(req.params.id!, req.body, req.user!.sub);
  res.json(order);
});

export const confirmOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.confirmOrder(req.params.id!, req.user!.sub);
  res.json(order);
});

export const sendToKitchenHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.sendToKitchen(req.params.id!, req.user!.sub);
  res.json(order);
});

export const markServedHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.markServed(req.params.id!, req.user!.sub);
  res.json(order);
});

export const completeOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.completeOrder(req.params.id!, req.user!.sub);
  res.json(order);
});

export const cancelOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.cancelOrder(req.params.id!, req.user!.sub, req.body?.reason);
  res.json(order);
});

export const createPaymentLinkHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = await ordersService.getOrCreatePaymentLinkToken(req.params.id!, req.user!.sub);
  res.json({ token });
});

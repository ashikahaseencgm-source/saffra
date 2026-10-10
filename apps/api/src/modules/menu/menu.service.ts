import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type { MenuItemDTO } from "@saffra/types";
import type { Prisma } from "@prisma/client";

function toMenuItemDTO(item: {
  id: string;
  name: string;
  description: string;
  price: unknown;
  foodType: string;
  imageUrl: string | null;
  available: boolean;
  featured: boolean;
  popular: boolean;
  categoryId: string;
  category: { name: string };
}): MenuItemDTO {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    categoryId: item.categoryId,
    categoryName: item.category.name,
    price: Number(item.price),
    foodType: item.foodType as MenuItemDTO["foodType"],
    imageUrl: item.imageUrl,
    available: item.available,
    featured: item.featured,
    popular: item.popular,
  };
}

export interface MenuQuery {
  q?: string;
  category?: string;
  foodType?: string;
  available?: boolean;
  popular?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export async function listMenuItems(restaurantId: string, query: MenuQuery): Promise<MenuItemDTO[]> {
  const where: Prisma.MenuItemWhereInput = {
    restaurantId,
    deletedAt: null,
  };

  if (query.available !== undefined) where.available = query.available;
  if (query.popular !== undefined) where.popular = query.popular;
  if (query.foodType) where.foodType = query.foodType as any;
  if (query.category) where.category = { name: query.category };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {
      ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
    };
  }
  if (query.q) {
    // SQLite's `contains` is already case-insensitive for ASCII by default
    // (no `mode` filter option — that's a Postgres/MySQL-only Prisma feature).
    where.OR = [
      { name: { contains: query.q } },
      { description: { contains: query.q } },
      { category: { name: { contains: query.q } } },
    ];
  }

  const items = await prisma.menuItem.findMany({
    where,
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });

  return items.map(toMenuItemDTO);
}

export async function listCategories(restaurantId: string) {
  return prisma.menuCategory.findMany({ where: { restaurantId }, orderBy: { sortOrder: "asc" } });
}

export async function createCategory(restaurantId: string, name: string, sortOrder: number) {
  return prisma.menuCategory.create({ data: { restaurantId, name, sortOrder } });
}

export async function getMenuItem(id: string): Promise<MenuItemDTO> {
  const item = await prisma.menuItem.findUnique({ where: { id }, include: { category: true } });
  if (!item || item.deletedAt) throw AppError.notFound("Menu item not found");
  return toMenuItemDTO(item);
}

export async function createMenuItem(restaurantId: string, data: any): Promise<MenuItemDTO> {
  const item = await prisma.menuItem.create({
    data: { ...data, restaurantId },
    include: { category: true },
  });
  return toMenuItemDTO(item);
}

export async function updateMenuItem(id: string, data: any): Promise<MenuItemDTO> {
  const item = await prisma.menuItem.update({ where: { id }, data, include: { category: true } });
  return toMenuItemDTO(item);
}

export async function deleteMenuItem(id: string): Promise<void> {
  await prisma.menuItem.update({ where: { id }, data: { deletedAt: new Date() } });
}

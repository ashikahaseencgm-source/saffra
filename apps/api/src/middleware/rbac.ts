import type { NextFunction, Request, Response } from "express";
import type { Role } from "@saffra/types";
import { AppError } from "../lib/errors.js";

/**
 * RBAC guard. Roles are hierarchical for read-heavy convenience but every
 * write-sensitive route still lists its explicit allowlist rather than
 * relying on the hierarchy, per the spec's per-role capability matrix.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden(`Requires one of roles: ${roles.join(", ")}`));
    }
    return next();
  };
}

export const ROLE_GROUPS = {
  all: ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as Role[],
  billingStaff: ["CASHIER", "MANAGER", "ADMIN"] as Role[],
  management: ["MANAGER", "ADMIN"] as Role[],
  adminOnly: ["ADMIN"] as Role[],
};

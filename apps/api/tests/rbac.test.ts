import { describe, it, expect, vi } from "vitest";
import { requireRole, ROLE_GROUPS } from "../src/middleware/rbac.js";
import { AppError } from "../src/lib/errors.js";
import type { Request, Response } from "express";

function mockReq(role?: string): Request {
  return { user: role ? { sub: "u1", employeeId: "E1", role, restaurantId: "r1" } : undefined } as any;
}

describe("rbac.requireRole", () => {
  it("calls next() with no error when the user has an allowed role", () => {
    const next = vi.fn();
    requireRole(...ROLE_GROUPS.management)(mockReq("MANAGER"), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next(AppError forbidden) when the role is not allowed", () => {
    const next = vi.fn();
    requireRole(...ROLE_GROUPS.management)(mockReq("WAITER"), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });

  it("calls next(AppError unauthorized) when there is no authenticated user", () => {
    const next = vi.fn();
    requireRole(...ROLE_GROUPS.all)(mockReq(undefined), {} as Response, next);
    const err = next.mock.calls[0]![0];
    expect(err.status).toBe(401);
  });

  it("adminOnly rejects manager", () => {
    const next = vi.fn();
    requireRole(...ROLE_GROUPS.adminOnly)(mockReq("MANAGER"), {} as Response, next);
    const err = next.mock.calls[0]![0];
    expect(err.status).toBe(403);
  });
});

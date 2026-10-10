import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshTtlToDate,
} from "../../lib/jwt.js";
import { recordAudit } from "../audit/auditService.js";
import type { AuthUserDTO, Role } from "@saffra/types";

function toAuthUserDTO(user: {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  tourCompletedAt: Date | null;
}): AuthUserDTO {
  return {
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    role: user.role as AuthUserDTO["role"],
    phone: user.phone,
    email: user.email,
    tourCompletedAt: user.tourCompletedAt ? user.tourCompletedAt.toISOString() : null,
  };
}

export async function completeTour(userId: string): Promise<AuthUserDTO> {
  const user = await prisma.user.update({ where: { id: userId }, data: { tourCompletedAt: new Date() } });
  return toAuthUserDTO(user);
}

export async function login(employeeId: string, password: string, meta: { ip?: string; userAgent?: string }) {
  const user = await prisma.user.findUnique({ where: { employeeId } });
  if (!user || !user.active || user.deletedAt) {
    throw AppError.unauthorized("Invalid employee ID or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized("Invalid employee ID or password");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    employeeId: user.employeeId,
    role: user.role as Role,
    restaurantId: user.restaurantId,
  });

  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTtlToDate(),
    },
  });

  await prisma.session.create({
    data: {
      userId: user.id,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ip ?? null,
      expiresAt: refreshTtlToDate(),
    },
  });

  await recordAudit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id });

  return { user: toAuthUserDTO(user), accessToken, refreshToken };
}

export async function refresh(refreshToken: string) {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(refreshToken) as any;
  } catch {
    throw AppError.unauthorized("Refresh token expired or invalid");
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw AppError.unauthorized("Refresh token expired or already used");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) throw AppError.unauthorized("Account is inactive");

  // Rotate: revoke old, issue new
  const newRefreshToken = signRefreshToken({ sub: user.id, jti: crypto.randomUUID() });
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date(), replacedByTokenHash: hashToken(newRefreshToken) },
    }),
    prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hashToken(newRefreshToken), expiresAt: refreshTtlToDate() },
    }),
  ]);

  const accessToken = signAccessToken({
    sub: user.id,
    employeeId: user.employeeId,
    role: user.role as Role,
    restaurantId: user.restaurantId,
  });

  return { accessToken, refreshToken: newRefreshToken, user: toAuthUserDTO(user) };
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string): Promise<AuthUserDTO> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound("User not found");
  return toAuthUserDTO(user);
}

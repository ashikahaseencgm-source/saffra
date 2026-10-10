import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { recordAudit } from "../audit/auditService.js";

const SELECT = {
  id: true,
  employeeId: true,
  name: true,
  role: true,
  phone: true,
  email: true,
  joiningDate: true,
  active: true,
  createdAt: true,
} as const;

export async function listStaff(restaurantId: string) {
  return prisma.user.findMany({
    where: { restaurantId, deletedAt: null },
    select: SELECT,
    orderBy: { name: "asc" },
  });
}

export async function getStaff(id: string) {
  const staff = await prisma.user.findUnique({ where: { id }, select: SELECT });
  if (!staff) throw AppError.notFound("Staff member not found");
  return staff;
}

export async function createStaff(
  restaurantId: string,
  data: { employeeId: string; name: string; role: string; phone?: string | null; email?: string | null; password: string },
  actorId: string,
) {
  const existing = await prisma.user.findUnique({ where: { employeeId: data.employeeId } });
  if (existing) throw AppError.conflict(`Employee ID ${data.employeeId} already exists`);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      restaurantId,
      employeeId: data.employeeId,
      name: data.name,
      role: data.role as any,
      phone: data.phone ?? null,
      email: data.email ?? null,
      passwordHash,
    },
    select: SELECT,
  });

  await recordAudit({ userId: actorId, action: "STAFF_CREATED", entity: "User", entityId: user.id });
  return user;
}

export async function updateStaff(id: string, data: Record<string, unknown>, actorId: string) {
  const user = await prisma.user.update({ where: { id }, data: data as any, select: SELECT });
  await recordAudit({ userId: actorId, action: "STAFF_UPDATED", entity: "User", entityId: id, metadata: data });
  return user;
}

export async function resetPassword(id: string, password: string, actorId: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  await recordAudit({ userId: actorId, action: "STAFF_PASSWORD_RESET", entity: "User", entityId: id });
}

export async function deactivateStaff(id: string, actorId: string) {
  await prisma.user.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
  await recordAudit({ userId: actorId, action: "STAFF_DEACTIVATED", entity: "User", entityId: id });
}

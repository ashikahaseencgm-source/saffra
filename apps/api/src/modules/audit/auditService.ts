import { prisma } from "../../lib/prisma.js";

export interface AuditEntry {
  userId?: string | null;
  orderId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      orderId: entry.orderId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      // SQLite has no native Json column — stored as a JSON-encoded string.
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    },
  });
}

export async function listAuditLogs(limit = 100) {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, employeeId: true, role: true } } },
  });
  return logs.map((log) => ({
    ...log,
    metadata: log.metadata ? (JSON.parse(log.metadata) as Record<string, unknown>) : null,
  }));
}

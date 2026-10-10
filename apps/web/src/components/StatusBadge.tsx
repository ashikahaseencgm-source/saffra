import { StatusPill, type PillTone } from "@saffra/ui";

const STATUS_MAP: Record<string, { label: string; tone: PillTone; pulse?: boolean }> = {
  // Order lifecycle
  DRAFT: { label: "Draft", tone: "neutral" },
  CONFIRMED: { label: "Confirmed", tone: "info" },
  SENT_TO_KITCHEN: { label: "Sent to Kitchen", tone: "warning", pulse: true },
  PREPARING: { label: "Preparing", tone: "warning", pulse: true },
  READY: { label: "Ready", tone: "accent", pulse: true },
  SERVED: { label: "Served", tone: "info" },
  PAYMENT_PENDING: { label: "Payment Pending", tone: "warning", pulse: true },
  PAID: { label: "Paid", tone: "success" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },

  // Tables
  AVAILABLE: { label: "Available", tone: "success" },
  OCCUPIED: { label: "Occupied", tone: "info" },
  ORDERING: { label: "Ordering", tone: "info" },
  FOOD_PREPARING: { label: "Food Preparing", tone: "warning", pulse: true },
  READY_TO_SERVE: { label: "Ready to Serve", tone: "accent", pulse: true },
  RESERVED: { label: "Reserved", tone: "neutral" },

  // Payments
  PENDING: { label: "Pending", tone: "neutral" },
  INITIATED: { label: "Initiated", tone: "info" },
  AUTHORIZED: { label: "Authorized", tone: "warning" },
  CAPTURED: { label: "Captured", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },

  // Kitchen tickets
  NEW: { label: "New", tone: "info", pulse: true },
  ACCEPTED: { label: "Accepted", tone: "warning" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_MAP[status] ?? { label: status, tone: "neutral" as const };
  return (
    <StatusPill tone={entry.tone} pulse={entry.pulse}>
      {entry.label}
    </StatusPill>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { loyaltyApi } from "../../api/loyalty.js";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** "Gold member · 320 points (₹320)" for a guest, when the loyalty program is on. */
export function LoyaltyBadge({ customerId }: { customerId: string }) {
  const { data } = useQuery({ queryKey: ["loyalty", "customer", customerId], queryFn: () => loyaltyApi.customer(customerId) });
  if (!data?.enabled) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-accent/25 bg-accent/5 p-3.5">
      <Gift className="h-6 w-6 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">
          {data.points} points <span className="font-normal text-muted">· worth {rupees(data.pointsValue)}</span>
        </p>
        <p className="text-xs text-muted">
          {data.nextTier
            ? `${rupees(data.nextTier.spendNeeded)} more to reach ${data.nextTier.name}`
            : data.tier
              ? "Top tier reached"
              : `Earns ${data.earnPercent}% back on every bill`}
          {data.expiringSoon > 0 && <span className="text-warning"> · {data.expiringSoon} expire this month</span>}
        </p>
      </div>
      {data.tier && (
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: data.tier.color }}>
          {data.tier.name}
        </span>
      )}
    </div>
  );
}

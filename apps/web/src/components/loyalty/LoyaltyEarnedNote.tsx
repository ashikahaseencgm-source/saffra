import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { loyaltyApi } from "../../api/loyalty.js";

/** After payment: "Rahul earned 75 points · now has 75 (₹75)". Hidden when there's nothing to say. */
export function LoyaltyEarnedNote({ orderId }: { orderId: string }) {
  const { data } = useQuery({ queryKey: ["loyalty", "order", orderId, "earned"], queryFn: () => loyaltyApi.order(orderId) });
  if (!data?.enabled || !data.customer || data.earnedPoints <= 0) return null;
  const c = data.customer;
  return (
    <div className="flex animate-slide-up items-start gap-3 rounded-xl border border-accent/25 bg-accent/5 p-3.5">
      <Gift className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <div>
        <p className="text-sm font-bold text-primary">
          {c.name} earned {data.earnedPoints} points 🎉
        </p>
        <p className="text-xs text-muted">
          Now has {c.points} points (worth ₹{c.pointsValue.toLocaleString("en-IN")}){c.tier ? ` · ${c.tier.name} member` : ""}
        </p>
      </div>
    </div>
  );
}

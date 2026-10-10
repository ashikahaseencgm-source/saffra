import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { Button, toast } from "@saffra/ui";
import type { OrderDTO } from "@saffra/types";
import { loyaltyApi } from "../../api/loyalty.js";
import { ApiError } from "../../api/client.js";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const EDITABLE = ["CONFIRMED", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED"];

/**
 * On the bill: the guest's points, one tap to use them, and what this bill
 * will earn. Points only leave the guest's balance once the bill is paid.
 */
export function LoyaltyRedeemCard({ order }: { order: OrderDTO }) {
  const queryClient = useQueryClient();
  const key = ["loyalty", "order", order.id, order.bill.grandTotal, order.status];
  const { data } = useQuery({ queryKey: key, queryFn: () => loyaltyApi.order(order.id), enabled: !!order.customerId });
  const [custom, setCustom] = useState<string>("");

  const apply = useMutation({
    mutationFn: (points: number) => loyaltyApi.applyPoints(order.id, points),
    onSuccess: (updated, points) => {
      queryClient.setQueryData(["orders", order.id], updated);
      queryClient.invalidateQueries({ queryKey: ["orders", order.id] });
      queryClient.invalidateQueries({ queryKey: ["loyalty"] });
      setCustom("");
      toast.success(points > 0 ? `${points} points used on this bill` : "Points removed from this bill");
    },
    onError: (err) => toast.error("Couldn't use points", err instanceof ApiError ? err.message : undefined),
  });

  if (!data?.enabled || !data.customer) return null;
  const c = data.customer;
  const editable = EDITABLE.includes(order.status);
  const applied = data.appliedPoints;
  const billBase = order.bill.subtotal - order.bill.discountAmount;
  const willEarn = Math.max(0, Math.floor((billBase * c.earnPercent) / 100 / (c.pointValue || 1)));

  return (
    <div className="space-y-2.5 rounded-xl border border-accent/25 bg-accent/5 p-3">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 shrink-0 text-accent" />
        <p className="flex-1 text-xs font-semibold text-primary">
          {c.name} has {c.points} points <span className="font-normal text-muted">({rupees(c.pointsValue)})</span>
        </p>
        {c.tier && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: c.tier.color }}>
            {c.tier.name}
          </span>
        )}
      </div>

      {applied > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-success">
            Using <b>{applied} points</b> (−{rupees(order.bill.loyaltyDiscount)})
          </p>
          {editable && (
            <button onClick={() => apply.mutate(0)} className="text-xs font-semibold text-muted hover:text-danger">
              Remove
            </button>
          )}
        </div>
      ) : data.maxRedeemablePoints > 0 && editable ? (
        <div className="space-y-2">
          <Button size="sm" variant="secondary" fullWidth loading={apply.isPending} onClick={() => apply.mutate(data.maxRedeemablePoints)}>
            Use {data.maxRedeemablePoints} points · save {rupees(data.maxRedeemablePoints * c.pointValue)}
          </Button>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={data.maxRedeemablePoints}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Or enter points"
              className="h-9 min-w-0 flex-1 rounded-lg border border-borderc bg-white px-2.5 text-xs outline-none focus:border-secondary"
            />
            <Button size="sm" variant="outline" disabled={!Number(custom)} onClick={() => apply.mutate(Math.min(Number(custom), data.maxRedeemablePoints))}>
              Use
            </Button>
          </div>
        </div>
      ) : (
        c.points < c.redeemMinPoints && (
          <p className="text-[11px] text-muted">Points can be used from {c.redeemMinPoints} points.</p>
        )
      )}

      {data.earnedPoints > 0 ? (
        <p className="text-[11px] font-semibold text-success">Earned {data.earnedPoints} points on this bill 🎉</p>
      ) : (
        willEarn > 0 && <p className="text-[11px] text-muted">This bill will earn about {willEarn} points when paid.</p>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Gift, Plus, Save, Sparkles, Trash2, Users } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, cn, toast } from "@saffra/ui";
import { PageHeader } from "../components/PageHeader.js";
import { loyaltyApi, type LoyaltyConfig, type LoyaltyTier } from "../api/loyalty.js";
import { menuApi } from "../api/menu.js";
import { ApiError } from "../api/client.js";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const EXAMPLE_TIERS: LoyaltyTier[] = [
  { name: "Bronze", minSpend: 5000, minVisits: 0, earnPercent: 2, color: "#B45309" },
  { name: "Silver", minSpend: 15000, minVisits: 0, earnPercent: 5, color: "#6B7C76" },
  { name: "Gold", minSpend: 30000, minVisits: 0, earnPercent: 8, color: "#CA8A04" },
];

/**
 * Loyalty program settings in plain language, with a live example so the
 * owner sees exactly what a guest gets before switching anything on.
 */
export function LoyaltyPage() {
  const queryClient = useQueryClient();
  const { data: saved } = useQuery({ queryKey: ["loyalty", "program"], queryFn: loyaltyApi.program });
  const { data: members = [] } = useQuery({ queryKey: ["loyalty", "members"], queryFn: loyaltyApi.members });
  const { data: categories = [] } = useQuery({ queryKey: ["menu", "categories"], queryFn: menuApi.categories });
  const [form, setForm] = useState<LoyaltyConfig | null>(null);

  useEffect(() => {
    if (saved && !form) setForm(saved);
  }, [saved, form]);

  const save = useMutation({
    mutationFn: (data: LoyaltyConfig) => loyaltyApi.saveProgram(data),
    onSuccess: (next) => {
      setForm(next);
      queryClient.setQueryData(["loyalty", "program"], next);
      queryClient.invalidateQueries({ queryKey: ["loyalty", "members"] });
      toast.success("Loyalty program saved");
    },
    onError: (err) => toast.error("Couldn't save", err instanceof ApiError ? err.message : undefined),
  });

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  if (!form) return <div className="p-10 text-center text-sm text-muted">Loading…</div>;

  const set = <K extends keyof LoyaltyConfig>(key: K, value: LoyaltyConfig[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const setTier = (i: number, patch: Partial<LoyaltyTier>) => set("tiers", form.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const examplePoints = Math.floor((1000 * form.earnPercent) / 100 / (form.pointValue || 1));
  const enabledMembers = members.filter((m) => m.points > 0 || m.tier);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 pb-28">
      <PageHeader eyebrow="Customers" title="Loyalty program" description="Reward regulars with points they can use on their next bill. Change any rule at any time." />

      <div
        className={cn(
          "mt-6 flex flex-col gap-4 rounded-card border p-5 sm:flex-row sm:items-center",
          form.enabled ? "border-success/30 bg-success/5" : "border-borderc bg-white",
        )}
      >
        <Gift className={cn("h-10 w-10 shrink-0", form.enabled ? "text-success" : "text-muted")} />
        <div className="flex-1">
          <p className="font-display text-lg font-bold text-primary">{form.enabled ? "Loyalty program is ON" : "Loyalty program is OFF"}</p>
          <p className="text-sm text-muted">
            {form.enabled
              ? "Guests who give their phone number earn points on every paid bill."
              : "Switch it on when you're happy with the rules below. Nothing changes for guests until then."}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={form.enabled}
          aria-label="Loyalty program on or off"
          onClick={() => set("enabled", !form.enabled)}
          className={cn("relative h-9 w-16 shrink-0 rounded-full transition-colors", form.enabled ? "bg-success" : "bg-borderc")}
        >
          <span className={cn("absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all", form.enabled ? "left-8" : "left-1")} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary px-5 py-4 text-white">
        <Sparkles className="h-6 w-6 shrink-0 text-accent" />
        <p className="text-[15px]">
          <b>Example:</b> a {rupees(1000)} bill earns <b className="text-accent">{examplePoints} points</b>, worth{" "}
          <b className="text-accent">{rupees(examplePoints * form.pointValue)}</b> off a future bill
          {form.tiers.length > 0 ? " (more for higher tiers)" : ""}.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>How guests earn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NumberRow label="Reward on each bill" suffix="% of the bill" value={form.earnPercent} step={0.5} onChange={(v) => set("earnPercent", v)} />
            <NumberRow label="Value of 1 point" prefix="₹" value={form.pointValue} step={0.25} onChange={(v) => set("pointValue", v)} />
            <NumberRow label="Smallest bill that earns points" prefix="₹" value={form.minBillToEarn} step={50} onChange={(v) => set("minBillToEarn", v)} />
            <NumberRow label="Welcome bonus (first visit)" suffix="points" value={form.welcomeBonusPoints} step={5} onChange={(v) => set("welcomeBonusPoints", Math.round(v))} />
            <div className="grid grid-cols-2 gap-3">
              <NumberRow label="Bonus every" suffix="visits" value={form.visitBonusEvery} onChange={(v) => set("visitBonusEvery", Math.round(v))} />
              <NumberRow label="Bonus amount" suffix="points" value={form.visitBonusPoints} step={5} onChange={(v) => set("visitBonusPoints", Math.round(v))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How guests use points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NumberRow label="Points needed before they can be used" suffix="points" value={form.redeemMinPoints} step={10} onChange={(v) => set("redeemMinPoints", Math.round(v))} />
            <NumberRow label="Most of a bill that points can pay" suffix="% of the bill" value={form.maxRedeemPercent} step={5} onChange={(v) => set("maxRedeemPercent", v)} />
            <NumberRow label="Points expire after" suffix="days (0 = never)" value={form.expiryDays} step={30} onChange={(v) => set("expiryDays", Math.round(v))} />
            {categories.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-primary">Menu sections that don't earn points</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const off = form.excludedCategoryIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => set("excludedCategoryIds", off ? form.excludedCategoryIds.filter((id) => id !== c.id) : [...form.excludedCategoryIds, c.id])}
                        className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", off ? "border-danger/40 bg-danger/5 text-danger line-through" : "border-borderc text-primary")}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-muted">Tap a section to exclude it (for example, alcohol).</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tiers — reward your best regulars more</CardTitle>
          {form.tiers.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForm((f) => (f ? { ...f, tiers: EXAMPLE_TIERS, earnPercent: Math.min(f.earnPercent, 1) } : f))}
            >
              <Crown className="h-4 w-4" /> Use Bronze / Silver / Gold example
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {form.tiers.length === 0 && <p className="text-sm text-muted">No tiers yet — every guest earns the same rate.</p>}
          {form.tiers.some((t) => t.earnPercent < form.earnPercent) && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              Some tiers earn less than the {form.earnPercent}% every guest gets. Tier rates should usually be higher.
            </p>
          )}
          {form.tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-borderc p-3 sm:grid-cols-[auto_1.4fr_1fr_1fr_1fr_auto]">
              <input type="color" value={t.color} onChange={(e) => setTier(i, { color: e.target.value })} aria-label={`${t.name} colour`} className="h-11 w-11 cursor-pointer rounded-lg border border-borderc" />
              <Field label="Tier name">
                <input value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} className="input-base" />
              </Field>
              <Field label="Spent at least (₹)">
                <input type="number" min={0} value={t.minSpend} onChange={(e) => setTier(i, { minSpend: Number(e.target.value) })} className="input-base" />
              </Field>
              <Field label="Visits at least">
                <input type="number" min={0} value={t.minVisits} onChange={(e) => setTier(i, { minVisits: Number(e.target.value) })} className="input-base" />
              </Field>
              <Field label="Reward %">
                <input type="number" min={0} step={0.5} value={t.earnPercent} onChange={(e) => setTier(i, { earnPercent: Number(e.target.value) })} className="input-base" />
              </Field>
              <button onClick={() => set("tiers", form.tiers.filter((_, idx) => idx !== i))} aria-label={`Remove ${t.name}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-danger/5 hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {form.tiers.length > 0 && form.tiers.length < 10 && (
            <button
              onClick={() => set("tiers", [...form.tiers, { name: "New tier", minSpend: 0, minVisits: 0, earnPercent: form.earnPercent, color: "#D63A5E" }])}
              className="flex items-center gap-1.5 text-sm font-semibold text-secondary"
            >
              <Plus className="h-4 w-4" /> Add a tier
            </button>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enabledMembers.length === 0 ? (
            <p className="text-sm text-muted">No members yet. Guests join automatically when staff add their phone number to an order, or when they order from the table QR code.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2">Guest</th>
                    <th>Tier</th>
                    <th className="text-right">Points</th>
                    <th className="text-right">Visits</th>
                    <th className="text-right">Total spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderc">
                  {enabledMembers.map((m) => (
                    <tr key={m.customerId}>
                      <td className="py-2.5">
                        <p className="font-semibold text-primary">{m.name}</p>
                        <p className="text-xs text-muted">{m.phone}</p>
                      </td>
                      <td>
                        {m.tier ? (
                          <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: m.tier.color }}>
                            {m.tier.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="text-right font-semibold text-primary">
                        {m.points} <span className="text-xs font-normal text-muted">({rupees(m.pointsValue)})</span>
                      </td>
                      <td className="text-right">{m.visits}</td>
                      <td className="text-right">{rupees(m.totalSpent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 lg:pl-64">
          <div className="flex items-center gap-4 rounded-2xl bg-primary px-5 py-3 text-white shadow-elevated">
            <span className="text-sm">You have unsaved changes</span>
            <Button variant="outline" size="sm" onClick={() => setForm(saved ?? null)}>
              Undo
            </Button>
            <Button size="sm" variant="success" loading={save.isPending} onClick={() => save.mutate(form)}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-primary">{label}</span>
      <span className="flex items-center gap-2">
        {prefix && <span className="text-base font-semibold text-muted">{prefix}</span>}
        <input
          type="number"
          min={0}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="input-base w-32"
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

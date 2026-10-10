import { useState, type FormEvent } from "react";
import { Phone, UserCheck, History, ArrowRight, UserPlus } from "lucide-react";
import { Modal, Button, Input, toast } from "@saffra/ui";
import { customersApi, type CustomerLookupResult } from "../../api/customers.js";
import { ApiError } from "../../api/client.js";
import { LoyaltyBadge } from "../loyalty/LoyaltyBadge.js";

export function CustomerLookupModal({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (data: { customerId: string | null; customerName: string | null }) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [lookupResult, setLookupResult] = useState<CustomerLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  function reset() {
    setPhone("");
    setName("");
    setLookupResult(null);
  }

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    if (phone.trim().length < 7) return;
    setLoading(true);
    try {
      const result = await customersApi.lookup(phone);
      setLookupResult(result);
    } catch (err) {
      toast.error("Couldn't look up customer", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartReturning() {
    if (!lookupResult?.customer) return;
    onStart({ customerId: lookupResult.customer.id, customerName: lookupResult.customer.name });
    reset();
  }

  async function handleStartNew() {
    if (name.trim().length < 2) {
      toast.warning("Enter the customer's name");
      return;
    }
    setStarting(true);
    try {
      const customer = await customersApi.create(phone, name.trim());
      onStart({ customerId: customer.id, customerName: customer.name });
      reset();
    } catch (err) {
      toast.error("Couldn't save customer", err instanceof ApiError ? err.message : undefined);
    } finally {
      setStarting(false);
    }
  }

  function handleSkip() {
    onStart({ customerId: null, customerName: null });
    reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Seat a Customer" size="sm">
      <div className="space-y-4">
        {!lookupResult ? (
          <form onSubmit={handleLookup} className="space-y-4">
            <Input
              label="Customer phone number"
              icon={<Phone className="h-4 w-4" />}
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
              required
            />
            <Button type="submit" fullWidth loading={loading}>
              Continue
            </Button>
          </form>
        ) : lookupResult.found && lookupResult.customer ? (
          <div className="animate-slide-up space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">Welcome back, {lookupResult.customer.name}!</p>
                <p className="text-xs text-muted">Visit #{lookupResult.customer.visitCount + 1} · {lookupResult.customer.phone}</p>
              </div>
            </div>

            <LoyaltyBadge customerId={lookupResult.customer.id} />

            {lookupResult.previousOrder && (
              <div className="rounded-xl border border-borderc bg-bg p-3.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <History className="h-3.5 w-3.5" /> Previous order
                </p>
                <p className="text-sm text-primary">
                  {lookupResult.previousOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                </p>
                <p className="mt-1 text-xs text-muted">
                  ₹{lookupResult.previousOrder.grandTotal.toLocaleString("en-IN")} ·{" "}
                  {new Date(lookupResult.previousOrder.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
            )}

            <Button fullWidth onClick={handleStartReturning}>
              <ArrowRight className="h-4 w-4" /> Start Order for {lookupResult.customer.name}
            </Button>
            <button onClick={reset} className="w-full text-center text-xs font-medium text-muted hover:text-primary">
              Wrong number? Try again
            </button>
          </div>
        ) : (
          <div className="animate-slide-up space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-secondary/20 bg-secondary/5 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">First time here?</p>
                <p className="text-xs text-muted">We couldn't find {phone} — add their name to remember them next visit.</p>
              </div>
            </div>
            <Input label="Customer name" placeholder="e.g. Priya Menon" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            <Button fullWidth loading={starting} onClick={handleStartNew}>
              Save &amp; Start Order
            </Button>
            <button onClick={reset} className="w-full text-center text-xs font-medium text-muted hover:text-primary">
              Use a different number
            </button>
          </div>
        )}

        {!lookupResult && (
          <button onClick={handleSkip} className="w-full text-center text-xs font-medium text-muted hover:text-primary">
            Skip — seat as walk-in
          </button>
        )}
      </div>
    </Modal>
  );
}

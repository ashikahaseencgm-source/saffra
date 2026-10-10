import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Eye, EyeOff, CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { Button, Input, Modal, toast, cn } from "@saffra/ui";
import type { PaymentGatewayStatusDTO } from "@saffra/types";
import { settingsApi } from "../../api/settings.js";
import { ApiError } from "../../api/client.js";
import { useAuthStore } from "../../store/authStore.js";

const RAZORPAY_KEYS_URL = "https://dashboard.razorpay.com/app/website-app-settings/api-keys";

/**
 * Connects the restaurant's OWN Razorpay account, so online payments (UPI,
 * cards, net banking) go straight to them. Plain-language on purpose: the
 * person filling this in is usually the owner, not a developer.
 */
export function OnlinePaymentsCard({ onConnected }: { onConnected?: () => void }) {
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === "ADMIN");
  const { data: status, isLoading } = useQuery({ queryKey: ["payment-gateway"], queryFn: settingsApi.getPaymentGateway });
  const [editing, setEditing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  function refresh(next: PaymentGatewayStatusDTO) {
    queryClient.setQueryData(["payment-gateway"], next);
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  const recheck = useMutation({
    mutationFn: settingsApi.recheckPaymentGateway,
    onSuccess: (result) => {
      refresh(result.status);
      if (result.verified) toast.success("Razorpay confirmed your keys");
      else toast.error("Couldn't reach Razorpay", "Check the internet connection and try again.");
    },
    onError: (err) => toast.error("Razorpay check failed", err instanceof ApiError ? err.message : undefined),
  });

  const disconnect = useMutation({
    mutationFn: settingsApi.removePaymentGateway,
    onSuccess: (next) => {
      refresh(next);
      setConfirmDisconnect(false);
      toast.success("Razorpay disconnected", "Online payments are back in practice mode.");
    },
    onError: (err) => toast.error("Couldn't disconnect", err instanceof ApiError ? err.message : undefined),
  });

  if (isLoading || !status) return <div className="h-32 animate-pulse rounded-xl bg-bg" />;

  const connected = status.provider !== "DEMO";
  const showForm = isAdmin && (editing || !connected || status.source === "UNREADABLE");

  return (
    <div className="space-y-4">
      {status.source === "UNREADABLE" ? (
        <StatusBox tone="danger" icon={<AlertTriangle className="h-6 w-6" />} title="Please enter your Razorpay keys again">
          Your saved keys can't be read on this computer any more. Online payments are paused until you enter them again —
          cash payments still work.
        </StatusBox>
      ) : connected ? (
        <StatusBox
          tone={status.verifiedAt ? "success" : "warning"}
          icon={status.verifiedAt ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          title={`Connected to your Razorpay account${status.mode === "TEST" ? " — Test mode" : ""}`}
          aside={
            isAdmin &&
            !editing && (
              <div className="flex shrink-0 flex-wrap gap-2">
                {!status.verifiedAt && (
                  <Button variant="outline" size="sm" loading={recheck.isPending} onClick={() => recheck.mutate()}>
                    <RefreshCw className="h-4 w-4" /> Check now
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Change keys
                </Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDisconnect(true)}>
                  Disconnect
                </Button>
              </div>
            )
          }
        >
          <span className="font-mono text-xs">{status.keyId}</span>
          <br />
          {status.verifiedAt
            ? "Payments go straight to your bank account through Razorpay."
            : "Saved, but not confirmed yet — Razorpay couldn't be reached. Tap “Check now” when the internet is working."}
          {status.mode === "TEST" && (
            <>
              <br />
              <strong>Test mode: no real money moves.</strong> Switch to your Live keys when you're ready for real payments.
            </>
          )}
          {status.source === "ENVIRONMENT" && (
            <>
              <br />
              These keys were set up on the server by your technician. Saving keys here will replace them.
            </>
          )}
        </StatusBox>
      ) : (
        <StatusBox tone="accent" icon={<CreditCard className="h-6 w-6" />} title="Practice mode — online payments are simulated">
          Connect your own Razorpay account to accept real UPI, card and net banking payments straight into your bank
          account. Until then, the online checkout is a safe simulation and no money moves. Cash always works.
        </StatusBox>
      )}

      {showForm ? (
        <RazorpayKeysForm
          onCancel={connected && status.source !== "UNREADABLE" ? () => setEditing(false) : undefined}
          onSaved={(next) => {
            refresh(next);
            setEditing(false);
            onConnected?.();
          }}
        />
      ) : (
        !isAdmin &&
        !connected && <p className="text-sm text-muted">Only the owner (Admin login) can connect a Razorpay account.</p>
      )}

      <Modal
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        title="Disconnect Razorpay?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDisconnect(false)}>
              Keep connected
            </Button>
            <Button variant="danger" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Online payments will go back to practice mode (simulated, no real money). Past payments and receipts are not
          affected. You can connect again at any time.
        </p>
      </Modal>
    </div>
  );
}

function RazorpayKeysForm({
  onSaved,
  onCancel,
}: {
  onSaved: (status: PaymentGatewayStatusDTO) => void;
  onCancel?: () => void;
}) {
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => settingsApi.savePaymentGateway({ keyId: keyId.trim(), keySecret: keySecret.trim() }),
    onSuccess: (result) => {
      setKeySecret("");
      if (result.verified) toast.success("Razorpay connected", "Online payments now go to your account.");
      else toast.success("Keys saved", "We'll confirm them with Razorpay once the internet is available.");
      onSaved(result.status);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again."),
  });

  const keyIdLooksWrong = keyId.trim().length > 4 && !/^rzp_(test|live)_/.test(keyId.trim());

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-borderc p-4">
      <ol className="space-y-1 text-sm text-muted">
        <li>
          1. Open your{" "}
          <a href={RAZORPAY_KEYS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-secondary">
            Razorpay dashboard → API Keys <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>2. Click “Generate Key” (or “Regenerate”) and copy both values.</li>
        <li>3. Paste them below.</li>
      </ol>
      <Input
        label="Key ID"
        placeholder="rzp_live_xxxxxxxxxxxx"
        value={keyId}
        onChange={(e) => setKeyId(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        error={keyIdLooksWrong ? "A Key ID starts with “rzp_live_” or “rzp_test_”." : undefined}
      />
      <Input
        label="Key Secret"
        type={showSecret ? "text" : "password"}
        placeholder="Paste the Key Secret"
        value={keySecret}
        onChange={(e) => setKeySecret(e.target.value)}
        autoComplete="new-password"
        spellCheck={false}
        trailing={
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            aria-label={showSecret ? "Hide key secret" : "Show key secret"}
            className="text-muted hover:text-primary"
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      <p className="text-xs text-muted">
        The Key Secret is stored encrypted on this computer and is never shown again or sent to anyone else's phone.
      </p>
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={save.isPending} disabled={!keyId.trim() || !keySecret.trim() || keyIdLooksWrong}>
          Connect Razorpay
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

const TONES = {
  success: "border-success/30 bg-success/5 text-success",
  warning: "border-warning/30 bg-warning/5 text-warning",
  danger: "border-danger/30 bg-danger/5 text-danger",
  accent: "border-accent/30 bg-accent/5 text-accent",
};

function StatusBox({
  tone,
  icon,
  title,
  aside,
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start", TONES[tone])}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{children}</p>
      </div>
      {aside}
    </div>
  );
}

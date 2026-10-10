import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Store,
  Percent,
  UserCog,
  UtensilsCrossed,
  ClipboardList,
  Wifi,
  Sparkles,
} from "lucide-react";
import { Button, Input, toast, cn } from "@saffra/ui";
import { setupApi, type CompleteSetupInput } from "../api/setup.js";
import { useAuthStore } from "../store/authStore.js";
import { ApiError } from "../api/client.js";
import { ConnectDevicesCard } from "../components/settings/ConnectDevicesCard.js";
import logoIcon from "../assets/logo.png";

type FormState = CompleteSetupInput;

const DEFAULT_FORM: FormState = {
  restaurant: { name: "", address: "", city: "", gstin: "", phone: "", email: "" },
  tax: { cgstPercent: 2.5, sgstPercent: 2.5, serviceChargePercent: 5 },
  admin: { name: "", employeeId: "ADM001", password: "" },
  tableCount: 10,
  loadSampleMenu: true,
};

const STEPS = ["Welcome", "Restaurant", "Tax", "Admin Account", "Tables & Menu", "Review"] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep(): string | null {
    if (step === 1 && !form.restaurant.name.trim()) return "Give your restaurant a name to continue.";
    if (step === 3) {
      if (!form.admin.name.trim()) return "Enter your name.";
      if (form.admin.employeeId.trim().length < 3) return "Employee ID must be at least 3 characters.";
      if (form.admin.password.length < 6) return "Password must be at least 6 characters.";
      if (form.admin.password !== confirmPassword) return "Passwords don't match.";
    }
    if (step === 4 && (form.tableCount < 1 || form.tableCount > 200)) return "Enter a table count between 1 and 200.";
    return null;
  }

  function goNext() {
    const validationError = validateStep();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFinish() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await setupApi.complete({
        ...form,
        admin: { ...form.admin, employeeId: form.admin.employeeId.toUpperCase() },
      });
      setSession(result);
      // Deliberately NOT updating the ["setup","status"] cache yet — the
      // gate would immediately see needsOnboarding:false while we're still
      // sitting on /onboarding and redirect away before this screen ever
      // shows. It flips only once the person clicks through, together with
      // the navigate() away from /onboarding.
      // The Wi-Fi name follows the restaurant name that was just saved.
      queryClient.invalidateQueries({ queryKey: ["setup", "network-info"] });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong setting up your restaurant.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <ServerReadyScreen
        onContinue={() => {
          queryClient.setQueryData(["setup", "status"], { needsOnboarding: false });
          navigate("/", { replace: true });
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-borderc bg-white px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logoIcon} alt="Saffra" className="h-8 w-8 rounded-lg" />
            <span className="font-display text-lg font-bold text-primary">Saffra Setup</span>
          </div>
          <span className="text-xs font-semibold text-muted">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div className="mx-auto mt-3 max-w-2xl">
          <div className="flex gap-1.5">
            {STEPS.map((label, i) => (
              <div key={label} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-borderc")} />
            ))}
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="rounded-card border border-borderc bg-white p-8 shadow-card">
            {step === 0 && <WelcomeStep />}
            {step === 1 && <RestaurantStep form={form} update={update} />}
            {step === 2 && <TaxStep form={form} update={update} />}
            {step === 3 && <AdminStep form={form} update={update} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} />}
            {step === 4 && <TablesMenuStep form={form} update={update} />}
            {step === 5 && <ReviewStep form={form} />}

            {error && (
              <div className="mt-5 rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-sm font-medium text-danger">{error}</div>
            )}

            <div className="mt-8 flex items-center justify-between">
              {step > 0 ? (
                <Button variant="outline" onClick={goBack} disabled={submitting}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              ) : (
                <span />
              )}
              {step < STEPS.length - 1 ? (
                <Button onClick={goNext}>
                  {step === 0 ? "Get Started" : "Continue"} <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleFinish} loading={submitting}>
                  <CheckCircle2 className="h-4 w-4" /> Set Up My Restaurant
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StepHeader({ icon: Icon, title, description }: { icon: typeof Store; title: string; description: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-display text-lg font-bold text-primary">{title}</h2>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient-radial">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <h1 className="font-display text-2xl font-bold text-primary">Welcome to Saffra</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        Let's get your restaurant set up. This takes about two minutes — your restaurant details, a couple of tax
        numbers, your own admin login, and how many tables you have. Everything runs locally on this computer, no
        internet or cloud account required.
      </p>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 text-left">
        {[
          { icon: Store, label: "Restaurant details" },
          { icon: UserCog, label: "Your admin login" },
          { icon: Wifi, label: "Ready on your Wi-Fi" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="rounded-xl border border-borderc bg-bg p-3 text-center">
            <Icon className="mx-auto h-4 w-4 text-secondary" />
            <p className="mt-1.5 text-[11px] font-medium text-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RestaurantStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const r = form.restaurant;
  const set = (patch: Partial<FormState["restaurant"]>) => update("restaurant", { ...r, ...patch });
  return (
    <div>
      <StepHeader icon={Store} title="Tell us about your restaurant" description="This appears on receipts and payment links." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Restaurant name" wrapperClassName="sm:col-span-2" value={r.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Saffra Bistro" autoFocus required />
        <Input label="Address" wrapperClassName="sm:col-span-2" value={r.address ?? ""} onChange={(e) => set({ address: e.target.value })} placeholder="Street address" />
        <Input label="City" value={r.city ?? ""} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. Chennai" />
        <Input label="GSTIN (optional)" value={r.gstin ?? ""} onChange={(e) => set({ gstin: e.target.value })} placeholder="e.g. 33ABCDE1234F1Z5" />
        <Input label="Phone" value={r.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 " />
        <Input label="Email" type="email" value={r.email ?? ""} onChange={(e) => set({ email: e.target.value })} placeholder="owner@restaurant.com" />
      </div>
    </div>
  );
}

function TaxStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const t = form.tax;
  const set = (patch: Partial<FormState["tax"]>) => update("tax", { ...t, ...patch });
  return (
    <div>
      <StepHeader icon={Percent} title="Tax & service charge" description="Applied automatically to every bill. India's standard restaurant GST split is pre-filled — adjust if yours differs." />
      <div className="grid grid-cols-3 gap-4">
        <Input label="CGST %" type="number" step="0.1" min={0} max={50} value={t.cgstPercent} onChange={(e) => set({ cgstPercent: Number(e.target.value) })} />
        <Input label="SGST %" type="number" step="0.1" min={0} max={50} value={t.sgstPercent} onChange={(e) => set({ sgstPercent: Number(e.target.value) })} />
        <Input label="Service Charge %" type="number" step="0.1" min={0} max={50} value={t.serviceChargePercent} onChange={(e) => set({ serviceChargePercent: Number(e.target.value) })} />
      </div>
      <p className="mt-4 text-xs text-muted">You can change these any time later in Settings.</p>
    </div>
  );
}

function AdminStep({
  form,
  update,
  confirmPassword,
  setConfirmPassword,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
}) {
  const a = form.admin;
  const set = (patch: Partial<FormState["admin"]>) => update("admin", { ...a, ...patch });
  return (
    <div>
      <StepHeader icon={UserCog} title="Create your admin login" description="This is how you'll sign in — you can add waiters, cashiers, and managers afterward in Staff." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Your name" wrapperClassName="sm:col-span-2" value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Arjun Mehta" autoFocus required />
        <Input label="Employee ID" value={a.employeeId} onChange={(e) => set({ employeeId: e.target.value.toUpperCase() })} placeholder="e.g. ADM001" required />
        <div />
        <Input label="Password" type="password" value={a.password} onChange={(e) => set({ password: e.target.value })} placeholder="At least 6 characters" required />
        <Input label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" required />
      </div>
    </div>
  );
}

function TablesMenuStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div>
      <StepHeader icon={UtensilsCrossed} title="Tables & starter menu" description="Both are easy to change later in Tables and Menu Management." />
      <Input
        label="Number of tables"
        type="number"
        min={1}
        max={200}
        value={form.tableCount}
        onChange={(e) => update("tableCount", Number(e.target.value))}
        wrapperClassName="max-w-xs"
      />
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-borderc bg-bg p-4">
        <input
          type="checkbox"
          id="loadSampleMenu"
          checked={form.loadSampleMenu}
          onChange={(e) => update("loadSampleMenu", e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-borderc text-accent focus:ring-accent/40"
        />
        <label htmlFor="loadSampleMenu" className="cursor-pointer text-sm">
          <span className="font-semibold text-primary">Start with a sample menu</span>
          <p className="mt-0.5 text-xs text-muted">
            Adds ~20 common Indian restaurant dishes across 7 categories so you have something to test with right
            away. Uncheck this if you'd rather add your own menu from scratch.
          </p>
        </label>
      </div>
    </div>
  );
}

function ReviewStep({ form }: { form: FormState }) {
  return (
    <div>
      <StepHeader icon={ClipboardList} title="Review & finish" description="Double-check the details below, then set up your restaurant." />
      <div className="space-y-3 text-sm">
        <ReviewRow label="Restaurant" value={form.restaurant.name || "—"} />
        <ReviewRow label="Location" value={[form.restaurant.city, form.restaurant.address].filter(Boolean).join(", ") || "—"} />
        <ReviewRow label="Tax" value={`CGST ${form.tax.cgstPercent}% · SGST ${form.tax.sgstPercent}% · Service ${form.tax.serviceChargePercent}%`} />
        <ReviewRow label="Admin login" value={`${form.admin.name || "—"} (${form.admin.employeeId})`} />
        <ReviewRow label="Tables" value={String(form.tableCount)} />
        <ReviewRow label="Starter menu" value={form.loadSampleMenu ? "Yes, load sample menu" : "No, I'll add my own"} />
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-borderc/70 px-3.5 py-2.5">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-primary">{value}</span>
    </div>
  );
}

function ServerReadyScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-2xl rounded-card border border-borderc bg-white p-8 shadow-card">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-9 w-9 text-success" />
          </div>
          <h1 className="mt-5 font-display text-xl font-bold text-primary">You're all set!</h1>
          <p className="mt-2 text-sm text-muted">Saffra is running on this computer, ready for your whole floor.</p>
        </div>

        <div className="mt-6 rounded-xl border border-borderc bg-bg p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Wifi className="h-3.5 w-3.5" /> Open Saffra on your staff's phones and tablets
          </p>
          <ConnectDevicesCard canEditName={false} />
          <p className="mt-3 text-xs text-muted">No app install needed. You can find this again any time in Settings.</p>
        </div>

        <Button fullWidth size="lg" className="mt-6" onClick={onContinue}>
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

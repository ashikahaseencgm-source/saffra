import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogIn, ArrowRight, UtensilsCrossed, Wallet, ChefHat } from "lucide-react";
import { Button, Input, toast } from "@saffra/ui";
import { authApi } from "../api/auth.js";
import { useAuthStore } from "../store/authStore.js";
import { ApiError } from "../api/client.js";
import logoIcon from "../assets/logo.png";

const DEMO_LOGINS = [
  { role: "Waiter", id: "WTR001" },
  { role: "Cashier", id: "CSH001" },
  { role: "Manager", id: "MGR001" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.login(employeeId.trim(), password);
      setSession(result);
      toast.success(`Welcome back, ${result.user.name.split(" ")[0]}`);
      const redirectTo = (location.state as any)?.from?.pathname ?? "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Hero panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-brand-gradient-radial" />
        <div className="absolute inset-0 bg-dot-grid bg-dot-sm opacity-[0.06]" />
        <div
          className="absolute -left-24 -top-24 h-72 w-72 animate-float rounded-full bg-accent/20 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 -right-10 h-80 w-80 animate-float rounded-full bg-secondary/25 blur-3xl"
          style={{ animationDelay: "1.5s" }}
          aria-hidden
        />

        <div className="relative z-10 flex items-center gap-3 px-14 pt-14">
          <img src={logoIcon} alt="" className="h-10 w-10 drop-shadow-[0_4px_12px_rgba(214,58,94,0.35)]" />
          <span className="font-display text-2xl font-bold tracking-tight text-white">Saffra</span>
        </div>

        <div className="relative z-10 px-14 pb-16">
          <h1 className="font-display text-4xl font-bold leading-tight text-white">
            Every table,
            <br />
            in tune.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            Tables, kitchen and payments — in one flow. One connected operating system for
            your entire floor — from the first order to the last receipt.
          </p>

          <div className="mt-10 flex gap-3">
            {[
              { icon: UtensilsCrossed, label: "Tables" },
              { icon: ChefHat, label: "Kitchen" },
              { icon: Wallet, label: "Payments" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <img src={logoIcon} alt="Saffra" className="mb-4 h-12 w-12 rounded-2xl shadow-glow lg:hidden" />
            <h2 className="font-display text-2xl font-bold text-primary">Sign in to Saffra</h2>
            <p className="mt-1.5 text-sm text-muted">Enter your employee ID and password to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Employee ID"
              placeholder="e.g. WTR001"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
              autoFocus
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-sm font-medium text-danger">
                {error}
              </div>
            )}
            <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          </form>

          <div className="mt-8 rounded-card border border-dashed border-borderc bg-white p-4">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Try a demo login</p>
            <div className="space-y-1.5">
              {DEMO_LOGINS.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  onClick={() => {
                    setEmployeeId(demo.id);
                    setPassword("password123");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-bg"
                >
                  <span className="text-primary">
                    {demo.role} <span className="text-muted">· {demo.id}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  BookOpen,
  ChefHat,
  Wallet,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@saffra/ui";
import { useAuthStore } from "../../store/authStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { NAV_ITEMS } from "../layout/navConfig.js";

interface TourStep {
  key: string; // matches a page's data-tour-target
  path: string;
  icon: typeof LayoutDashboard;
  title: string;
  description: string;
  bullets: string[];
}

const ALL_STEPS: TourStep[] = [
  {
    key: "dashboard",
    path: "/",
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Your at-a-glance view of the day.",
    bullets: [
      "Today's revenue, orders, active tables, and pending payments",
      "A 7-day revenue trend (managers and admins)",
      "Recent Activity shows your latest orders — click \"See more\" for full history",
    ],
  },
  {
    key: "tables",
    path: "/tables",
    icon: UtensilsCrossed,
    title: "Tables",
    description: "The floor, at a glance.",
    bullets: [
      "Tap any available table to seat a customer and start an order",
      "Colors show status — occupied, food preparing, ready to serve, payment pending",
      "\"Bill Customer\" and \"Clear Table\" are right there on each tile",
    ],
  },
  {
    key: "orders",
    path: "/orders",
    icon: ClipboardList,
    title: "Order History",
    description: "Every order, searchable and filterable.",
    bullets: ["Filter by status, date range, or table", "One place to look up any past order or reprint a receipt"],
  },
  {
    key: "menu",
    path: "/menu",
    icon: BookOpen,
    title: "Menu Management",
    description: "Your dishes, prices, and categories.",
    bullets: ["Add, edit, or 86 (mark unavailable) any item in seconds", "Organize items into categories that show up in the ordering screen"],
  },
  {
    key: "kitchen",
    path: "/kitchen",
    icon: ChefHat,
    title: "Kitchen Display",
    description: "Built for the kitchen, not the front desk.",
    bullets: [
      "Tickets move New → Accepted → Preparing → Ready automatically",
      "A chime plays when a new ticket lands",
      "Only ever shows what's actually new — repeats never resend already-served items",
    ],
  },
  {
    key: "payments",
    path: "/payments",
    icon: Wallet,
    title: "Payments",
    description: "Cash, card, UPI, or a link — your call.",
    bullets: [
      "Bill a table directly, or send a customer a payment link for their own phone",
      "Works in Demo Mode out of the box — plug in Razorpay any time for live payments",
    ],
  },
  {
    key: "reports",
    path: "/reports",
    icon: BarChart3,
    title: "Reports",
    description: "Know what's working.",
    bullets: ["Revenue trends and top-selling items", "Waiter performance and table utilization"],
  },
  {
    key: "staff",
    path: "/staff",
    icon: Users,
    title: "Staff",
    description: "Your team, with their own logins.",
    bullets: ["Add waiters, cashiers, managers, and admins", "Each person gets their own employee ID and password"],
  },
  {
    key: "settings",
    path: "/settings",
    icon: SettingsIcon,
    title: "Settings",
    description: "Your setup, in one place.",
    bullets: [
      "Adjust tax rates, restaurant details, and receipt footer any time",
      "Find your Wi-Fi connection address here whenever a new device needs it",
    ],
  },
];

const SPOTLIGHT_PAD = 10;
const CARD_WIDTH = 360;
const CARD_GAP = 16;

export function ProductTour({ open, onFinish }: { open: boolean; onFinish: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore((s) => s.user?.role);
  const setTourActive = useUiStore((s) => s.setTourActive);

  const steps = ALL_STEPS.filter((step) => {
    const navItem = NAV_ITEMS.find((n) => n.to === step.path);
    return !role || !navItem || navItem.roles.includes(role);
  });

  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const measureAttempt = useRef(0);

  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  useEffect(() => {
    setTourActive(open);
    return () => setTourActive(false);
  }, [open, setTourActive]);

  useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

  // Navigate to the step's page, then find + measure its highlighted
  // section. The target may not exist yet the instant the route changes
  // (route transition, data still loading) so this polls briefly via rAF
  // rather than assuming it's there on the first frame.
  useEffect(() => {
    if (!open || !current) return;
    if (location.pathname !== current.path) {
      navigate(current.path);
      return;
    }

    let cancelled = false;
    measureAttempt.current = 0;
    setRect(null);

    function measure() {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour-target="${current!.key}"]`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
        requestAnimationFrame(() => {
          if (!cancelled) setRect(el.getBoundingClientRect());
        });
        return;
      }
      if (measureAttempt.current < 40) {
        measureAttempt.current += 1;
        requestAnimationFrame(measure);
      }
    }
    requestAnimationFrame(measure);

    return () => {
      cancelled = true;
    };
  }, [open, step, current, location.pathname, navigate]);

  // Keep the spotlight glued to its target through scrolling/resizing.
  useEffect(() => {
    if (!open || !current) return;
    function reposition() {
      const el = document.querySelector(`[data-tour-target="${current!.key}"]`);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, step, current]);

  if (!open || !current) return null;

  const Icon = current.icon;

  const cardStyle = computeCardPosition(rect);

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Blocks interaction with the page underneath while the tour runs. */}
      <div className="absolute inset-0" />

      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-accent transition-all duration-300 ease-out"
          style={{
            top: rect.top - SPOTLIGHT_PAD,
            left: rect.left - SPOTLIGHT_PAD,
            width: rect.width + SPOTLIGHT_PAD * 2,
            height: rect.height + SPOTLIGHT_PAD * 2,
            boxShadow: "0 0 0 9999px rgba(19,48,42,0.7)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-primary/70 backdrop-blur-sm" />
      )}

      <div
        className={cn(
          "fixed flex flex-col overflow-hidden rounded-card bg-white shadow-elevated transition-all duration-300 ease-out",
          !rect && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        style={{ width: CARD_WIDTH, ...cardStyle }}
      >
        <div className="relative overflow-hidden bg-primary px-6 pb-5 pt-5">
          <div className="absolute inset-0 bg-dot-grid bg-dot-sm opacity-[0.06]" />
          <button
            onClick={onFinish}
            className="absolute right-3.5 top-3.5 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Quick Tour · {step + 1} of {steps.length}
          </div>
          <div className="relative mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">{current.title}</h2>
              <p className="text-xs text-white/60">{current.description}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <ul className="space-y-2.5">
            {current.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-[13px] leading-snug text-primary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {bullet}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-center gap-1.5">
            {steps.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                aria-label={`Go to ${s.title}`}
                className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-accent" : "w-1.5 bg-borderc hover:bg-muted/50")}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-borderc px-6 py-3.5">
          <button onClick={onFinish} className="text-xs font-semibold text-muted hover:text-primary">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 rounded-xl border border-borderc px-3.5 py-2 text-xs font-semibold text-primary hover:bg-bg"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <button
              onClick={() => (isLast ? onFinish() : setStep((s) => s + 1))}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary/90"
            >
              {isLast ? "Let's go" : "Next"} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Places the card beside its spotlighted target, clamped to stay fully on screen. */
function computeCardPosition(rect: DOMRect | null): React.CSSProperties {
  if (!rect) return {};

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const estimatedCardHeight = 360;

  const left = Math.min(Math.max(rect.left, 16), vw - CARD_WIDTH - 16);

  const fitsBelow = rect.bottom + CARD_GAP + estimatedCardHeight < vh;
  if (fitsBelow) {
    return { top: rect.bottom + CARD_GAP, left };
  }
  const fitsAbove = rect.top - CARD_GAP - estimatedCardHeight > 0;
  if (fitsAbove) {
    return { top: Math.max(16, rect.top - CARD_GAP - estimatedCardHeight), left };
  }
  // Neither fits cleanly (short viewport) — pin to the right of the target instead.
  const fitsRight = rect.right + CARD_GAP + CARD_WIDTH < vw;
  if (fitsRight) {
    return { top: Math.max(16, Math.min(rect.top, vh - estimatedCardHeight - 16)), left: rect.right + CARD_GAP };
  }
  return { top: Math.max(16, Math.min(rect.top, vh - estimatedCardHeight - 16)), left: Math.max(16, rect.left - CARD_GAP - CARD_WIDTH) };
}

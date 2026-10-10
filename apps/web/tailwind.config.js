/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#13302A",
        secondary: "#0E9F8E",
        accent: "#D63A5E",
        surface: "#FFFFFF",
        bg: "#F7F4EE",
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
        muted: "#6B7C76",
        borderc: "#E7E2D8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Courier New'", "monospace"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(19,48,42,0.04), 0 1px 6px -1px rgba(19,48,42,0.06)",
        elevated: "0 4px 16px -4px rgba(19,48,42,0.12), 0 2px 6px -2px rgba(19,48,42,0.08)",
        glow: "0 0 0 1px rgba(214,58,94,0.15), 0 8px 24px -4px rgba(214,58,94,0.25)",
        "glow-blue": "0 0 0 1px rgba(14,159,142,0.15), 0 8px 24px -4px rgba(14,159,142,0.25)",
        ticket: "0 2px 8px -2px rgba(19,48,42,0.12), 0 12px 32px -8px rgba(19,48,42,0.14)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #D63A5E 0%, #EC6F8A 35%, #0E9F8E 100%)",
        "brand-gradient-radial": "radial-gradient(circle at 30% 20%, rgba(214,58,94,0.35), transparent 55%), radial-gradient(circle at 80% 80%, rgba(14,159,142,0.35), transparent 55%)",
        "dot-grid": "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
        "dot-grid-light": "radial-gradient(rgba(19,48,42,0.08) 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-sm": "18px 18px",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        "pulse-glow": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.55 } },
        float: { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-6px)" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        marquee: "marquee 18s linear infinite",
      },
    },
  },
  plugins: [],
};

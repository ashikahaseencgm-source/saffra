// Shared constants used by both apps/api and apps/web.

export const BRAND = {
  name: "Saffra",
  tagline: "Every table, in tune.",
  subtitle: "Tables, kitchen and payments — in one flow.",
  colors: {
    primary: "#13302A",
    secondary: "#0E9F8E",
    accent: "#D63A5E",
    background: "#F7F4EE",
    surface: "#FFFFFF",
    success: "#16A34A",
    warning: "#F59E0B",
    danger: "#DC2626",
    muted: "#6B7C76",
    border: "#E7E2D8",
  },
} as const;

export const DEFAULT_TAX_CONFIG = {
  cgstPercent: 2.5,
  sgstPercent: 2.5,
  serviceChargePercent: 5,
  currency: "INR",
  currencySymbol: "₹",
};

export const DEMO_CREDENTIALS = [
  { employeeId: "WTR001", password: "password123", role: "WAITER", name: "Rahul Sharma" },
  { employeeId: "CSH001", password: "password123", role: "CASHIER", name: "Priya Nair" },
  { employeeId: "MGR001", password: "password123", role: "MANAGER", name: "Arjun Mehta" },
  { employeeId: "ADM001", password: "password123", role: "ADMIN", name: "Saffra Admin" },
] as const;

export const RECEIPT_FOOTER_DEFAULT = "Thank you for dining with us. Visit again!";

import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  BookOpen,
  Wallet,
  ChefHat,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  Gift,
} from "lucide-react";
import type { Role } from "@saffra/types";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, roles: ["WAITER", "CASHIER", "MANAGER", "ADMIN"] },
  { label: "Tables", to: "/tables", icon: UtensilsCrossed, roles: ["WAITER", "CASHIER", "MANAGER", "ADMIN"] },
  { label: "Orders", to: "/orders", icon: ClipboardList, roles: ["WAITER", "CASHIER", "MANAGER", "ADMIN"] },
  { label: "Menu", to: "/menu", icon: BookOpen, roles: ["MANAGER", "ADMIN"] },
  { label: "Payments", to: "/payments", icon: Wallet, roles: ["CASHIER", "MANAGER", "ADMIN"] },
  { label: "Kitchen", to: "/kitchen", icon: ChefHat, roles: ["WAITER", "CASHIER", "MANAGER", "ADMIN"] },
  { label: "Loyalty", to: "/loyalty", icon: Gift, roles: ["MANAGER", "ADMIN"] },
  { label: "Reports", to: "/reports", icon: BarChart3, roles: ["MANAGER", "ADMIN"] },
  { label: "Staff", to: "/staff", icon: Users, roles: ["MANAGER", "ADMIN"] },
  { label: "Settings", to: "/settings", icon: SettingsIcon, roles: ["MANAGER", "ADMIN"] },
];

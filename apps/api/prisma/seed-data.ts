import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { renderReceiptHtml } from "../src/modules/receipts/receiptHtml.js";
import type { ReceiptData } from "../src/modules/receipts/receiptTypes.js";

// ────────────────────────────────────────────────────────────────
// Deterministic-ish seed data generator shared by two consumers:
//   1. prisma/seed.ts            — inserts via Prisma Client (needs a live DB)
//   2. scripts/generate-seed-sql.ts — emits plain SQL INSERT statements
// Keeping the data-building logic here means both paths always agree.
// ────────────────────────────────────────────────────────────────

export const uid = () => crypto.randomUUID();

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface SeedCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface SeedMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  foodType: "VEG" | "NON_VEG" | "EGG";
  featured: boolean;
  popular: boolean;
}

export interface SeedTable {
  id: string;
  number: number;
  capacity: number;
  status: string;
}

export interface SeedStaff {
  id: string;
  employeeId: string;
  name: string;
  role: "WAITER" | "CASHIER" | "MANAGER" | "ADMIN";
  phone: string;
  email: string;
  passwordHash: string;
}

export interface SeedOrderItem {
  id: string;
  menuItemId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  notes: string | null;
}

export interface SeedOrder {
  id: string;
  orderNumber: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  status: string;
  tableId: string | null;
  waiterId: string;
  note: string | null;
  items: SeedOrderItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  serviceCharge: number;
  discountAmount: number;
  discountReason: string | null;
  roundOff: number;
  grandTotal: number;
  createdAt: Date;
  confirmedAt: Date | null;
  completedAt: Date | null;
  payment: SeedPayment | null;
  kitchenTicket: boolean;
}

export interface SeedPayment {
  id: string;
  provider: "DEMO";
  providerOrderId: string;
  providerPaymentId: string | null;
  method: "UPI" | "CREDIT_CARD" | "DEBIT_CARD" | "NET_BANKING" | "WALLET" | "CASH";
  amount: number;
  state: "CAPTURED" | "INITIATED";
  cashierId: string | null;
  capturedAt: Date | null;
}

const CATEGORY_DEFS: { name: string; items: [string, string, number, "VEG" | "NON_VEG" | "EGG"][] }[] = [
  {
    name: "Starters",
    items: [
      ["Paneer Tikka", "Char-grilled cottage cheese marinated in smoky spices", 280, "VEG"],
      ["Chicken Lollipop", "Frenched chicken wings tossed in a spicy glaze", 320, "NON_VEG"],
      ["Veg Spring Roll", "Crisp rolls stuffed with julienned vegetables", 220, "VEG"],
      ["Chilli Paneer", "Wok-tossed paneer in a tangy chilli-garlic sauce", 260, "VEG"],
      ["Tandoori Chicken (Half)", "Classic clay-oven roasted chicken", 350, "NON_VEG"],
      ["Hara Bhara Kebab", "Spinach and green pea patties, lightly pan-fried", 240, "VEG"],
    ],
  },
  {
    name: "Soups",
    items: [
      ["Tomato Soup", "Slow-simmered tomato soup with a hint of basil", 140, "VEG"],
      ["Sweet Corn Soup", "Comforting corn broth with vegetables", 150, "VEG"],
      ["Hot & Sour Soup", "Spicy Indo-Chinese soup with fresh vegetables", 160, "VEG"],
    ],
  },
  {
    name: "Indian Main Course",
    items: [
      ["Butter Chicken", "Tandoori chicken simmered in a rich tomato-butter gravy", 380, "NON_VEG"],
      ["Paneer Butter Masala", "Cottage cheese in a velvety tomato-cashew gravy", 320, "VEG"],
      ["Dal Makhani", "Slow-cooked black lentils finished with cream", 260, "VEG"],
      ["Chana Masala", "Chickpeas simmered in a tangy onion-tomato masala", 220, "VEG"],
      ["Kadai Paneer", "Paneer and bell peppers in a kadai masala", 300, "VEG"],
      ["Chicken Curry", "Home-style chicken curry with warm spices", 340, "NON_VEG"],
      ["Palak Paneer", "Cottage cheese cubes in a smooth spinach gravy", 290, "VEG"],
      ["Malai Kofta", "Fried vegetable-cheese dumplings in a creamy gravy", 300, "VEG"],
    ],
  },
  {
    name: "Chinese",
    items: [
      ["Veg Manchurian", "Fried vegetable dumplings in a tangy Manchurian sauce", 240, "VEG"],
      ["Chicken Manchurian", "Crisp chicken tossed in a soy-chilli sauce", 300, "NON_VEG"],
      ["Veg Hakka Noodles", "Wok-tossed noodles with fresh vegetables", 220, "VEG"],
      ["Chicken Fried Rice", "Wok-fried rice with diced chicken and vegetables", 260, "NON_VEG"],
      ["Veg Fried Rice", "Wok-fried rice with mixed vegetables", 210, "VEG"],
      ["Chilli Chicken", "Indo-Chinese style spicy chicken stir-fry", 310, "NON_VEG"],
    ],
  },
  {
    name: "Biryani",
    items: [
      ["Veg Biryani", "Fragrant basmati rice layered with spiced vegetables", 260, "VEG"],
      ["Chicken Biryani", "Slow-cooked dum-style chicken biryani", 320, "NON_VEG"],
      ["Mutton Biryani", "Rich, slow-cooked mutton dum biryani", 380, "NON_VEG"],
      ["Egg Biryani", "Fragrant biryani rice with boiled eggs", 240, "EGG"],
    ],
  },
  {
    name: "Rice",
    items: [
      ["Jeera Rice", "Basmati rice tempered with cumin", 180, "VEG"],
      ["Steamed Rice", "Plain steamed basmati rice", 140, "VEG"],
      ["Curd Rice", "South Indian style tempered curd rice", 160, "VEG"],
      ["Ghee Rice", "Fragrant rice tossed in clarified butter and whole spices", 190, "VEG"],
    ],
  },
  {
    name: "Breads",
    items: [
      ["Butter Naan", "Tandoor-baked leavened bread brushed with butter", 60, "VEG"],
      ["Garlic Naan", "Tandoor-baked naan topped with garlic and coriander", 70, "VEG"],
      ["Tandoori Roti", "Whole-wheat bread baked in the tandoor", 40, "VEG"],
      ["Laccha Paratha", "Multi-layered flaky whole-wheat paratha", 70, "VEG"],
      ["Missi Roti", "Spiced gram-flour and wheat flatbread", 50, "VEG"],
    ],
  },
  {
    name: "Beverages",
    items: [
      ["Fresh Lime Soda", "Chilled soda with fresh lime, sweet or salted", 90, "VEG"],
      ["Cold Coffee", "Blended chilled coffee topped with froth", 130, "VEG"],
      ["Mango Lassi", "Thick yoghurt smoothie with Alphonso mango", 120, "VEG"],
      ["Masala Chaas", "Spiced buttermilk with curry leaf tempering", 80, "VEG"],
      ["Virgin Mojito", "Mint and lime cooler with soda", 150, "VEG"],
      ["Filter Coffee", "South Indian style decoction coffee", 60, "VEG"],
    ],
  },
  {
    name: "Desserts",
    items: [
      ["Gulab Jamun", "Warm milk-solid dumplings in rose-cardamom syrup", 100, "VEG"],
      ["Brownie with Ice Cream", "Warm chocolate brownie with vanilla ice cream", 160, "VEG"],
      ["Rasmalai", "Soft cottage-cheese discs in saffron-cardamom milk", 120, "VEG"],
    ],
  },
];

const STAFF_DEFS: { employeeId: string; name: string; role: SeedStaff["role"] }[] = [
  { employeeId: "WTR001", name: "Rahul Sharma", role: "WAITER" },
  { employeeId: "WTR002", name: "Sneha Iyer", role: "WAITER" },
  { employeeId: "WTR003", name: "Karthik Raman", role: "WAITER" },
  { employeeId: "WTR004", name: "Divya Menon", role: "WAITER" },
  { employeeId: "WTR005", name: "Vikram Reddy", role: "WAITER" },
  { employeeId: "CSH001", name: "Priya Nair", role: "CASHIER" },
  { employeeId: "CSH002", name: "Anand Kumar", role: "CASHIER" },
  { employeeId: "CSH003", name: "Meera Pillai", role: "CASHIER" },
  { employeeId: "MGR001", name: "Arjun Mehta", role: "MANAGER" },
  { employeeId: "MGR002", name: "Kavya Krishnan", role: "MANAGER" },
  { employeeId: "ADM001", name: "Saffra Admin", role: "ADMIN" },
  { employeeId: "WTR006", name: "Naveen Babu", role: "WAITER" },
];

const DISCOUNT_REASONS = ["Loyal Customer", "Staff Discount", "Festival Offer", "Manager Approval"];
const PAYMENT_METHODS: SeedPayment["method"][] = ["UPI", "CREDIT_CARD", "DEBIT_CARD", "NET_BANKING", "WALLET", "CASH"];
const CUSTOMER_NOTES = [null, null, null, "Less spicy", "No onion", "Extra cheese", "Jain preparation", "No garlic", "Serve quickly please"];

export interface SeedBundle {
  restaurant: {
    id: string;
    name: string;
    address: string;
    city: string;
    gstin: string;
    phone: string;
    email: string;
    invoicePrefix: string;
    receiptFooter: string;
  };
  taxConfig: { cgstPercent: number; sgstPercent: number; serviceChargePercent: number };
  categories: SeedCategory[];
  menuItems: SeedMenuItem[];
  tables: SeedTable[];
  staff: SeedStaff[];
  orders: SeedOrder[];
}

function computeBillLocal(
  items: { price: number; quantity: number }[],
  tax: { cgstPercent: number; sgstPercent: number; serviceChargePercent: number },
  discount?: { type: "PERCENTAGE" | "FLAT"; value: number } | null,
) {
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const subtotal = round2(items.reduce((s, i) => s + i.price * i.quantity, 0));
  let discountAmount = 0;
  if (discount) {
    discountAmount = discount.type === "PERCENTAGE" ? (subtotal * discount.value) / 100 : discount.value;
    discountAmount = round2(Math.max(0, Math.min(discountAmount, subtotal)));
  }
  const taxableBase = round2(subtotal - discountAmount);
  const cgst = round2((taxableBase * tax.cgstPercent) / 100);
  const sgst = round2((taxableBase * tax.sgstPercent) / 100);
  const serviceCharge = round2((taxableBase * tax.serviceChargePercent) / 100);
  const totalBeforeRound = taxableBase + cgst + sgst + serviceCharge;
  const grandTotal = Math.round(totalBeforeRound);
  const roundOff = round2(grandTotal - totalBeforeRound);
  return { subtotal, discountAmount, cgst, sgst, serviceCharge, roundOff, grandTotal };
}

export async function buildSeedBundle(): Promise<SeedBundle> {
  const restaurant = {
    id: uid(),
    name: "Saffra Bistro",
    address: "24 Anna Salai, Thousand Lights",
    city: "Chennai",
    gstin: "33ABCDE1234F1Z5",
    phone: "+91 44 4567 8901",
    email: "hello@saffrabistro.in",
    invoicePrefix: "SAF",
    receiptFooter: "Thank you for dining with us. Visit again!",
  };

  const taxConfig = { cgstPercent: 2.5, sgstPercent: 2.5, serviceChargePercent: 5 };

  const categories: SeedCategory[] = CATEGORY_DEFS.map((c, i) => ({ id: uid(), name: c.name, sortOrder: i }));

  const menuItems: SeedMenuItem[] = [];
  CATEGORY_DEFS.forEach((cat, ci) => {
    cat.items.forEach(([name, description, price, foodType], ii) => {
      menuItems.push({
        id: uid(),
        categoryId: categories[ci]!.id,
        name,
        description,
        price,
        foodType,
        featured: ii === 0,
        popular: Math.random() > 0.6,
      });
    });
  });

  const tables: SeedTable[] = Array.from({ length: 20 }, (_, i) => ({
    id: uid(),
    number: i + 1,
    capacity: pick([2, 2, 4, 4, 4, 6, 8]),
    status: "AVAILABLE",
  }));

  const passwordHash = await bcrypt.hash("password123", 10);
  const staff: SeedStaff[] = STAFF_DEFS.map((s) => ({
    id: uid(),
    employeeId: s.employeeId,
    name: s.name,
    role: s.role,
    phone: `+91 9${randInt(100000000, 999999999)}`,
    email: `${s.employeeId.toLowerCase()}@saffrabistro.in`,
    passwordHash,
  }));
  const waiters = staff.filter((s) => s.role === "WAITER");
  const cashiers = staff.filter((s) => s.role === "CASHIER");

  const orders: SeedOrder[] = [];

  // Reserve the last 8 tables exclusively for the "live right now" orders
  // seeded below, so historical orders (which pick a table at random) can
  // never accidentally claim all 20 tables and leave nothing free — that
  // would seed a demo where every table looks AVAILABLE and Kitchen/
  // Dashboard have nothing to show.
  const liveReservedTables = tables.slice(-8);
  const historicalTablePool = tables.slice(0, -8);

  function buildOrderItems(): SeedOrderItem[] {
    const count = randInt(1, 5);
    const chosen = new Set<string>();
    const items: SeedOrderItem[] = [];
    for (let i = 0; i < count; i++) {
      const menuItem = pick(menuItems);
      if (chosen.has(menuItem.id)) continue;
      chosen.add(menuItem.id);
      items.push({
        id: uid(),
        menuItemId: menuItem.id,
        nameSnapshot: menuItem.name,
        priceSnapshot: menuItem.price,
        quantity: randInt(1, 4),
        notes: pick(CUSTOMER_NOTES),
      });
    }
    return items.length > 0 ? items : buildOrderItems();
  }

  // 92 historical, completed/paid orders spread across the last 30 days.
  for (let i = 0; i < 92; i++) {
    const daysAgo = randInt(0, 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(randInt(11, 22), randInt(0, 59), 0, 0);

    const items = buildOrderItems();
    const waiter = pick(waiters);
    const isCancelled = Math.random() < 0.05;
    const hasDiscount = Math.random() < 0.15;
    const discount = hasDiscount
      ? { type: pick(["PERCENTAGE", "FLAT"] as const), value: pick([5, 10, 15, 50, 100]) }
      : null;

    const bill = computeBillLocal(
      items.map((i) => ({ price: i.priceSnapshot, quantity: i.quantity })),
      taxConfig,
      discount,
    );

    const table = Math.random() < 0.85 ? pick(historicalTablePool) : null;
    const status = isCancelled ? "CANCELLED" : "COMPLETED";
    const completedAt = new Date(createdAt.getTime() + randInt(20, 70) * 60000);

    orders.push({
      id: uid(),
      orderNumber: `SAF-${createdAt.getFullYear().toString().slice(-2)}${String(createdAt.getMonth() + 1).padStart(2, "0")}${String(createdAt.getDate()).padStart(2, "0")}-${uid().slice(0, 4).toUpperCase()}`,
      orderType: table ? "DINE_IN" : "TAKEAWAY",
      status,
      tableId: table?.id ?? null,
      waiterId: waiter.id,
      note: null,
      items,
      ...bill,
      discountReason: discount ? pick(DISCOUNT_REASONS) : null,
      createdAt,
      confirmedAt: new Date(createdAt.getTime() + 2 * 60000),
      completedAt: isCancelled ? null : completedAt,
      kitchenTicket: !isCancelled,
      payment: isCancelled
        ? null
        : {
            id: uid(),
            provider: "DEMO",
            providerOrderId: `order_demo_${uid().slice(0, 8)}`,
            providerPaymentId: `pay_demo_${uid().slice(0, 8)}`,
            method: pick(PAYMENT_METHODS),
            amount: bill.grandTotal,
            state: "CAPTURED",
            cashierId: Math.random() < 0.5 ? pick(cashiers).id : null,
            capturedAt: completedAt,
          },
    });
  }

  // 8 live orders occupying tables right now, across the active lifecycle states.
  const liveStatuses = ["DRAFT", "CONFIRMED", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED", "PAYMENT_PENDING"];

  for (let i = 0; i < liveReservedTables.length; i++) {
    const table = liveReservedTables[i]!;
    const status = liveStatuses[i % liveStatuses.length]!;
    const items = buildOrderItems();
    const waiter = pick(waiters);
    const createdAt = new Date(Date.now() - randInt(2, 45) * 60000);
    const bill = computeBillLocal(items.map((it) => ({ price: it.priceSnapshot, quantity: it.quantity })), taxConfig, null);

    const tableStatusMap: Record<string, string> = {
      DRAFT: "ORDERING",
      CONFIRMED: "ORDERING",
      SENT_TO_KITCHEN: "FOOD_PREPARING",
      PREPARING: "FOOD_PREPARING",
      READY: "READY_TO_SERVE",
      SERVED: "READY_TO_SERVE",
      PAYMENT_PENDING: "PAYMENT_PENDING",
    };
    table.status = tableStatusMap[status] ?? "OCCUPIED";

    orders.push({
      id: uid(),
      orderNumber: `SAF-${createdAt.getFullYear().toString().slice(-2)}${String(createdAt.getMonth() + 1).padStart(2, "0")}${String(createdAt.getDate()).padStart(2, "0")}-${uid().slice(0, 4).toUpperCase()}`,
      orderType: "DINE_IN",
      status,
      tableId: table.id,
      waiterId: waiter.id,
      note: Math.random() < 0.3 ? "Customer requested quick service." : null,
      items,
      ...bill,
      discountReason: null,
      createdAt,
      confirmedAt: status === "DRAFT" ? null : createdAt,
      completedAt: null,
      kitchenTicket: !["DRAFT", "CONFIRMED"].includes(status),
      payment:
        status === "PAYMENT_PENDING"
          ? {
              id: uid(),
              provider: "DEMO",
              providerOrderId: `order_demo_${uid().slice(0, 8)}`,
              providerPaymentId: null,
              method: "UPI",
              amount: bill.grandTotal,
              state: "INITIATED",
              cashierId: null,
              capturedAt: null,
            }
          : null,
    });
  }

  // Two reserved tables with no active order, for visual variety — picked
  // from whichever historical-pool tables happened not to be used above.
  const usedHistoricalTableIds = new Set(orders.filter((o) => o.tableId).map((o) => o.tableId));
  historicalTablePool
    .filter((t) => !usedHistoricalTableIds.has(t.id))
    .slice(0, 2)
    .forEach((t) => (t.status = "RESERVED"));

  return { restaurant, taxConfig, categories, menuItems, tables, staff, orders };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  UPI: "UPI",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  CASH: "Cash",
};

/**
 * Renders a REAL 80mm receipt (same renderer the live app uses) for a
 * captured seed order, instead of a placeholder string. Used by both
 * prisma/seed.ts and scripts/generate-seed-sql.ts so neither path ever
 * inserts a fake "Receipt for SAF-..." stand-in that would otherwise sit in
 * the Receipt table forever (the app caches whatever's already stored).
 */
export function buildReceiptHtmlForOrder(bundle: SeedBundle, order: SeedOrder): string | null {
  if (!order.payment || order.payment.state !== "CAPTURED") return null;

  const table = order.tableId ? bundle.tables.find((t) => t.id === order.tableId) : null;
  const waiter = bundle.staff.find((s) => s.id === order.waiterId);

  const data: ReceiptData = {
    restaurantName: bundle.restaurant.name,
    address: `${bundle.restaurant.address}, ${bundle.restaurant.city}`,
    gstin: bundle.restaurant.gstin,
    phone: bundle.restaurant.phone,
    receiptNumber: `${bundle.restaurant.invoicePrefix}-RCPT-${order.orderNumber.slice(-6)}`,
    orderNumber: order.orderNumber,
    tableLabel: table ? `Table ${table.number}` : order.orderType.replace("_", " "),
    waiterName: waiter?.name ?? "Staff",
    customerName: null,
    dateLabel: (order.completedAt ?? order.createdAt).toLocaleString("en-IN"),
    items: order.items.map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
      rate: i.priceSnapshot,
      total: i.priceSnapshot * i.quantity,
    })),
    subtotal: order.subtotal,
    cgst: order.cgst,
    sgst: order.sgst,
    serviceCharge: order.serviceCharge,
    discountAmount: order.discountAmount,
    discountReason: order.discountReason,
    roundOff: order.roundOff,
    grandTotal: order.grandTotal,
    paymentMethod: PAYMENT_METHOD_LABELS[order.payment.method] ?? order.payment.method,
    transactionId: order.payment.providerPaymentId ?? order.payment.providerOrderId,
    footer: bundle.restaurant.receiptFooter,
  };

  return renderReceiptHtml(data);
}

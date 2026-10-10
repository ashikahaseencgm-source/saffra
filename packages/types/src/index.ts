// Shared enums & DTO types used by both apps/api and apps/web.
// Kept in sync with prisma/schema.prisma enums — this is the single source
// of truth for the string literal unions on the frontend.

export const ROLES = ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const TABLE_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "ORDERING",
  "FOOD_PREPARING",
  "READY_TO_SERVE",
  "PAYMENT_PENDING",
  "COMPLETED",
  "RESERVED",
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "SENT_TO_KITCHEN",
  "PREPARING",
  "READY",
  "SERVED",
  "PAYMENT_PENDING",
  "PAID",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TYPES = ["DINE_IN", "TAKEAWAY", "DELIVERY"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

// Tracks each order line's own trip through the kitchen, independent of the
// whole order's status — this is what lets a repeat order ("customer wants
// another round of the same dish") land as a fresh line instead of silently
// re-triggering food that's already been delivered.
// PENDING = added but never yet sent to the kitchen (still DRAFT/CONFIRMED).
// FIRED   = the kitchen has (or will) see this on the active ticket.
// SERVED  = delivered — excluded from the kitchen ticket's item list.
export const ORDER_ITEM_KITCHEN_STATUSES = ["PENDING", "FIRED", "SERVED"] as const;
export type OrderItemKitchenStatus = (typeof ORDER_ITEM_KITCHEN_STATUSES)[number];

export const PAYMENT_STATES = [
  "PENDING",
  "INITIATED",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_METHODS = [
  "UPI",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "NET_BANKING",
  "WALLET",
  "CASH",
  "QR",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_PROVIDERS = ["DEMO", "RAZORPAY_TEST", "RAZORPAY_LIVE"] as const;
export type PaymentProviderKind = (typeof PAYMENT_PROVIDERS)[number];

/** How online payments are set up. The Razorpay key secret is never included. */
export interface PaymentGatewayStatusDTO {
  /** SETTINGS = restaurant's own keys; ENVIRONMENT = server env vars; UNREADABLE = must re-enter; NONE = demo. */
  source: "SETTINGS" | "ENVIRONMENT" | "UNREADABLE" | "NONE";
  provider: PaymentProviderKind;
  keyId: string | null;
  mode: "TEST" | "LIVE" | null;
  /** Last time Razorpay confirmed the keys; null = not confirmed yet (e.g. saved offline). */
  verifiedAt: string | null;
}

export const KITCHEN_TICKET_STATUSES = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
] as const;
export type KitchenTicketStatus = (typeof KITCHEN_TICKET_STATUSES)[number];

export const FOOD_TYPES = ["VEG", "NON_VEG", "EGG"] as const;
export type FoodType = (typeof FOOD_TYPES)[number];

export const DISCOUNT_TYPES = ["PERCENTAGE", "FLAT"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const MENU_CATEGORIES = [
  "Starters",
  "Soups",
  "Indian Main Course",
  "Chinese",
  "Biryani",
  "Rice",
  "Breads",
  "Beverages",
  "Desserts",
] as const;
export type MenuCategoryName = (typeof MENU_CATEGORIES)[number];

// ── DTOs shared between frontend/backend ──────────────────────

export interface AuthUserDTO {
  id: string;
  employeeId: string;
  name: string;
  role: Role;
  phone: string | null;
  email: string | null;
  // Null until this person has clicked through (or skipped) the first-run
  // product tour — drives whether it auto-launches on login.
  tourCompletedAt: string | null;
}

export interface MenuItemDTO {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  price: number;
  foodType: FoodType;
  imageUrl: string | null;
  available: boolean;
  featured: boolean;
  popular: boolean;
}

export interface CartItemInput {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

export interface OrderItemDTO {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  total: number;
  kitchenStatus: OrderItemKitchenStatus;
}

export interface BillBreakdownDTO {
  subtotal: number;
  cgst: number;
  sgst: number;
  gstTotal: number;
  serviceCharge: number;
  discountAmount: number;
  discountReason: string | null;
  /** Part of discountAmount paid with loyalty points. */
  loyaltyDiscount: number;
  loyaltyPointsRedeemed: number;
  roundOff: number;
  grandTotal: number;
}

export interface OrderDTO {
  id: string;
  orderNumber: string;
  tableId: string | null;
  tableNumber: number | null;
  orderType: OrderType;
  status: OrderStatus;
  waiterId: string;
  waiterName: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  items: OrderItemDTO[];
  note: string | null;
  bill: BillBreakdownDTO;
  createdAt: string;
  updatedAt: string;
}

export interface TableDTO {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  currentOrderId: string | null;
  currentBillTotal: number;
  elapsedMinutes: number | null;
  assignedWaiterName: string | null;
  customerName: string | null;
}

export interface PaymentCreateResponseDTO {
  paymentId: string;
  provider: PaymentProviderKind;
  providerOrderId: string;
  amount: number;
  currency: string;
  keyId?: string; // Razorpay public key id, only present for RAZORPAY_* providers
  restaurantName: string;
}

export interface PaymentVerifyRequestDTO {
  paymentId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature?: string;
  method?: PaymentMethod;
}

export interface DashboardStatsDTO {
  todaysRevenue: number;
  todaysOrders: number;
  activeTables: number;
  pendingPayments: number;
  kitchenOrders: number;
  averageBillValue: number;
}

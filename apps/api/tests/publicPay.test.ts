import { describe, it, expect, vi, beforeAll } from "vitest";
import { fake } from "./helpers/fakePrisma.js";

vi.mock("../src/lib/prisma.js", () => ({ prisma: fake.prisma }));

const RESTAURANT_ID = "aaaaaaaa-1111-1111-1111-111111111111";
const TABLE_A_ID = "aaaaaaaa-2222-1111-1111-111111111111";
const TABLE_B_ID = "aaaaaaaa-2222-2222-1111-111111111111";
const MENU_ITEM_ID = "aaaaaaaa-3333-1111-1111-111111111111";
const WAITER_ID = "aaaaaaaa-4444-1111-1111-111111111111";

beforeAll(() => {
  fake.db.restaurants.set(RESTAURANT_ID, {
    id: RESTAURANT_ID,
    name: "Saffra Bistro",
    invoicePrefix: "SAF",
    receiptFooter: "Thanks!",
    timezone: "Asia/Kolkata",
  });
  fake.db.taxConfigs.set(RESTAURANT_ID, { cgstPercent: 2.5, sgstPercent: 2.5, serviceChargePercent: 5 });
  fake.db.tables.set(TABLE_A_ID, { id: TABLE_A_ID, restaurantId: RESTAURANT_ID, number: 1, capacity: 4, status: "AVAILABLE" });
  fake.db.tables.set(TABLE_B_ID, { id: TABLE_B_ID, restaurantId: RESTAURANT_ID, number: 2, capacity: 4, status: "AVAILABLE" });
  fake.db.menuItems.set(MENU_ITEM_ID, { id: MENU_ITEM_ID, name: "Paneer Tikka", price: 280, available: true, deletedAt: null });
});

async function buildServedOrder(tableId: string) {
  const ordersService = await import("../src/modules/orders/orders.service.js");
  let order = await ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId, orderType: "DINE_IN" });
  order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
  order = await ordersService.confirmOrder(order.id, WAITER_ID);
  await ordersService.sendToKitchen(order.id, WAITER_ID);
  // Skip straight through the kitchen for this test's purposes — force SERVED.
  fake.db.orders.set(order.id, { ...fake.db.orders.get(order.id), status: "SERVED" });
  return order.id;
}

describe("publicPay — token-scoped payment links", () => {
  it("resolves a valid token to the right order summary", async () => {
    const orderId = await buildServedOrder(TABLE_A_ID);
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const publicPayService = await import("../src/modules/publicPay/publicPay.service.js");

    const token = await ordersService.getOrCreatePaymentLinkToken(orderId, WAITER_ID);
    const summary = await publicPayService.getPublicOrderSummary(token);

    expect(summary.restaurantName).toBe("Saffra Bistro");
    expect(summary.tableLabel).toBe("Table 1");
    expect(summary.items).toHaveLength(1);
    expect(summary.bill.grandTotal).toBeGreaterThan(0);
    expect(summary.alreadyPaid).toBe(false);
  });

  it("rejects an unknown token", async () => {
    const publicPayService = await import("../src/modules/publicPay/publicPay.service.js");
    await expect(publicPayService.getPublicOrderSummary("does-not-exist")).rejects.toThrow();
  });

  it("refuses to generate a link for an order that isn't payable yet (still DRAFT)", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const freshTableId = "aaaaaaaa-2222-3333-1111-111111111111";
    fake.db.tables.set(freshTableId, { id: freshTableId, restaurantId: RESTAURANT_ID, number: 3, capacity: 2, status: "AVAILABLE" });
    const order = await ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId: freshTableId, orderType: "DINE_IN" });

    await expect(ordersService.getOrCreatePaymentLinkToken(order.id, WAITER_ID)).rejects.toThrow();
  });

  it("SECURITY: a token cannot be used to act on a payment belonging to a different order", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const paymentsService = await import("../src/modules/payments/payments.service.js");
    const publicPayService = await import("../src/modules/publicPay/publicPay.service.js");

    const orderAId = await buildServedOrder(TABLE_B_ID);
    const freshTableId = "aaaaaaaa-2222-4444-1111-111111111111";
    fake.db.tables.set(freshTableId, { id: freshTableId, restaurantId: RESTAURANT_ID, number: 4, capacity: 2, status: "AVAILABLE" });
    const orderBId = await buildServedOrder(freshTableId);

    const tokenA = await ordersService.getOrCreatePaymentLinkToken(orderAId, WAITER_ID);
    const paymentB = await paymentsService.createPayment(orderBId, WAITER_ID);

    // Using order A's token to touch order B's paymentId must be rejected.
    await expect(publicPayService.assertPaymentBelongsToToken(tokenA, paymentB.paymentId)).rejects.toThrow();

    // But using order A's token with order A's own payment is fine.
    const paymentA = await paymentsService.createPayment(orderAId, WAITER_ID);
    await expect(publicPayService.assertPaymentBelongsToToken(tokenA, paymentA.paymentId)).resolves.not.toThrow();
  });

  it("a captured payment via a public link marks the order PAID and generates a receipt, same as staff checkout", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const paymentsService = await import("../src/modules/payments/payments.service.js");
    const publicPayService = await import("../src/modules/publicPay/publicPay.service.js");

    const freshTableId = "aaaaaaaa-2222-5555-1111-111111111111";
    fake.db.tables.set(freshTableId, { id: freshTableId, restaurantId: RESTAURANT_ID, number: 5, capacity: 2, status: "AVAILABLE" });
    const orderId = await buildServedOrder(freshTableId);

    const token = await ordersService.getOrCreatePaymentLinkToken(orderId, WAITER_ID);
    const orderIdFromToken = await publicPayService.assertTokenIsPayable(token);
    expect(orderIdFromToken).toBe(orderId);

    const payment = await paymentsService.createPayment(orderId, null);
    const result = await paymentsService.processDemoPayment(payment.paymentId, "UPI", "success", null);

    expect(result.state).toBe("CAPTURED");
    const order = await ordersService.getOrder(orderId);
    expect(order.status).toBe("PAID");
  });
});

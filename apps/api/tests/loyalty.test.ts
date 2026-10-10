import { describe, it, expect, vi, beforeAll } from "vitest";
import { fake } from "./helpers/fakePrisma.js";

vi.mock("../src/lib/prisma.js", () => ({ prisma: fake.prisma }));

const R = "eeeeeeee-1111-1111-1111-111111111111";
const TABLE = "eeeeeeee-2222-1111-1111-111111111111";
const FOOD = "eeeeeeee-5555-1111-1111-111111111111";
const DRINKS = "eeeeeeee-5555-2222-1111-111111111111";
const THALI = "eeeeeeee-3333-1111-1111-111111111111";
const BEER = "eeeeeeee-3333-2222-1111-111111111111";
const STAFF = "eeeeeeee-4444-1111-1111-111111111111";
const ADMIN = "eeeeeeee-4444-2222-1111-111111111111";

beforeAll(() => {
  fake.db.restaurants.set(R, { id: R, name: "Spice Garden", invoicePrefix: "SG", receiptFooter: "Thanks!", timezone: "Asia/Kolkata" });
  // No tax/service charge so the numbers are easy to follow.
  fake.db.taxConfigs.set(R, { cgstPercent: 0, sgstPercent: 0, serviceChargePercent: 0 });
  fake.db.tables.set(TABLE, { id: TABLE, restaurantId: R, number: 1, capacity: 4, status: "AVAILABLE", deletedAt: null });
  fake.db.menuItems.set(THALI, { id: THALI, restaurantId: R, categoryId: FOOD, name: "Thali", price: 1000, foodType: "VEG", available: true, deletedAt: null });
  fake.db.menuItems.set(BEER, { id: BEER, restaurantId: R, categoryId: DRINKS, name: "Beer", price: 500, foodType: "VEG", available: true, deletedAt: null });
});

async function paidVisit(customerId: string, items: [string, number][], usePoints = 0) {
  const orders = await import("../src/modules/orders/orders.service.js");
  const payments = await import("../src/modules/payments/payments.service.js");
  const loyalty = await import("../src/modules/loyalty/loyalty.service.js");
  let order = await orders.createOrder(R, STAFF, { tableId: TABLE, orderType: "DINE_IN", customerId });
  for (const [id, qty] of items) order = await orders.addOrderItem(order.id, { menuItemId: id, quantity: qty }, STAFF);
  await orders.confirmOrder(order.id, STAFF);
  await orders.sendToKitchen(order.id, STAFF);
  if (usePoints) order = await loyalty.applyPoints(order.id, usePoints, STAFF);
  else order = await orders.getOrder(order.id);
  await payments.processCashPayment(order.id, order.bill.grandTotal, STAFF);
  await orders.completeOrder(order.id, STAFF);
  return order;
}

describe("loyalty program end-to-end", () => {
  it("does nothing while switched off (but still tracks lifetime spend)", async () => {
    const loyalty = await import("../src/modules/loyalty/loyalty.service.js");
    const guest = await fake.prisma.customer.create({ data: { restaurantId: R, phone: "9000000001", name: "Off Guest" } });
    await paidVisit(guest.id, [[THALI, 1]]);
    const card = await loyalty.getCustomerLoyalty(guest.id);
    expect(card.points).toBe(0);
    expect(card.totalSpent).toBe(1000);
  });

  it("earns on paid bills (excluded categories don't count), with welcome bonus and tier upgrades", async () => {
    const loyalty = await import("../src/modules/loyalty/loyalty.service.js");
    await loyalty.updateLoyaltyConfig(
      R,
      {
        enabled: true,
        earnPercent: 5,
        pointValue: 1,
        redeemMinPoints: 100,
        maxRedeemPercent: 50,
        welcomeBonusPoints: 25,
        excludedCategoryIds: [DRINKS],
        tiers: [{ name: "Silver", minSpend: 2000, minVisits: 0, earnPercent: 10, color: "#94A3B8" }],
      },
      ADMIN,
    );
    const guest = await fake.prisma.customer.create({ data: { restaurantId: R, phone: "9000000002", name: "Rahul" } });

    // Visit 1: ₹1000 food + ₹500 beer. Beer is excluded → 5% of 1000 = 50, + 25 welcome.
    await paidVisit(guest.id, [[THALI, 1], [BEER, 1]]);
    let card = await loyalty.getCustomerLoyalty(guest.id);
    expect(card.points).toBe(75);
    expect(card.totalSpent).toBe(1500);
    expect(card.tier).toBeNull();
    expect(card.nextTier).toEqual({ name: "Silver", spendNeeded: 500, visitsNeeded: 0 });

    // Visit 2: ₹1000 → lifetime ₹2500 = Silver, so this bill already earns 10%.
    await paidVisit(guest.id, [[THALI, 1]]);
    card = await loyalty.getCustomerLoyalty(guest.id);
    expect(card.tier?.name).toBe("Silver");
    expect(card.points).toBe(175);
  });

  it("spends points on the bill (before tax), capped, and records them only when paid", async () => {
    const loyalty = await import("../src/modules/loyalty/loyalty.service.js");
    const orders = await import("../src/modules/orders/orders.service.js");
    const guest = Array.from(fake.db.customers.values()).find((c: any) => c.name === "Rahul");

    let order = await orders.createOrder(R, STAFF, { tableId: TABLE, orderType: "DINE_IN", customerId: guest.id });
    order = await orders.addOrderItem(order.id, { menuItemId: THALI, quantity: 1 }, STAFF);
    await orders.confirmOrder(order.id, STAFF);
    await orders.sendToKitchen(order.id, STAFF);

    const offer = await loyalty.getOrderLoyalty(order.id);
    expect(offer.maxRedeemablePoints).toBe(175); // balance 175, cap 50% of ₹1000 = 500
    await expect(loyalty.applyPoints(order.id, 600, STAFF)).rejects.toThrow(/At most 175/);

    order = await loyalty.applyPoints(order.id, 150, STAFF);
    expect(order.bill.loyaltyDiscount).toBe(150);
    expect(order.bill.grandTotal).toBe(850);
    // Not deducted yet — the guest could still change their mind.
    expect((await loyalty.getCustomerLoyalty(guest.id)).points).toBe(175);

    const payments = await import("../src/modules/payments/payments.service.js");
    await payments.processCashPayment(order.id, 850, STAFF);
    await orders.completeOrder(order.id, STAFF);
    const card = await loyalty.getCustomerLoyalty(guest.id);
    // 175 - 150 spent + 10% Silver rate on the ₹850 actually paid = 85.
    expect(card.points).toBe(110);
    expect(card.history.map((h) => h.type)).toEqual(expect.arrayContaining(["REDEEM", "EARN"]));
  });

  it("won't let points be used below the minimum balance, or once payment has started", async () => {
    const loyalty = await import("../src/modules/loyalty/loyalty.service.js");
    const orders = await import("../src/modules/orders/orders.service.js");
    const payments = await import("../src/modules/payments/payments.service.js");
    const guest = await fake.prisma.customer.create({ data: { restaurantId: R, phone: "9000000003", name: "New" } });
    let order = await orders.createOrder(R, STAFF, { tableId: TABLE, orderType: "DINE_IN", customerId: guest.id });
    order = await orders.addOrderItem(order.id, { menuItemId: THALI, quantity: 1 }, STAFF);
    await orders.confirmOrder(order.id, STAFF);
    await orders.sendToKitchen(order.id, STAFF);
    await expect(loyalty.applyPoints(order.id, 10, STAFF)).rejects.toThrow(/at least 100/);

    await payments.createPayment(order.id, STAFF);
    await expect(loyalty.applyPoints(order.id, 0, STAFF)).rejects.toThrow(/Payment has already started/);
  });

  it("removing items shrinks the points used so they're never more than the bill", async () => {
    const orders = await import("../src/modules/orders/orders.service.js");
    const order = await orders.createOrder(R, STAFF, { orderType: "TAKEAWAY" });
    await orders.addOrderItem(order.id, { menuItemId: THALI, quantity: 1 }, STAFF);
    const beerLine = await orders.addOrderItem(order.id, { menuItemId: BEER, quantity: 1 }, STAFF);
    const row = fake.db.orders.get(order.id);
    // 700 points applied on the ₹1500 bill, then the ₹1000 thali is removed:
    // only ₹500 is left, so only 500 points can still be used.
    Object.assign(row, { loyaltyPointsRedeemed: 700, loyaltyDiscount: 700 });
    const thali = beerLine.items.find((i) => i.menuItemId === THALI)!;
    const after = await orders.removeOrderItem(order.id, thali.id, STAFF);
    expect(after.bill.subtotal).toBe(500);
    expect(after.bill.loyaltyPointsRedeemed).toBe(500);
    expect(after.bill.loyaltyDiscount).toBe(500);
    expect(after.bill.grandTotal).toBe(0);
  });
});

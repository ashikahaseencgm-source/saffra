import { describe, it, expect, vi, beforeAll } from "vitest";
import { fake } from "./helpers/fakePrisma.js";

vi.mock("../src/lib/prisma.js", () => ({ prisma: fake.prisma }));

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
const TABLE_ID = "22222222-2222-2222-2222-222222222222";
const MENU_ITEM_ID = "33333333-3333-3333-3333-333333333333";
const WAITER_ID = "44444444-4444-4444-4444-444444444444";
const CASHIER_ID = "55555555-5555-5555-5555-555555555555";

beforeAll(() => {
  fake.db.restaurants.set(RESTAURANT_ID, {
    id: RESTAURANT_ID,
    name: "Saffra Bistro",
    invoicePrefix: "SAF",
    receiptFooter: "Thank you!",
    timezone: "Asia/Kolkata",
    gstin: "33ABCDE1234F1Z5",
    address: "Chennai",
    city: "Chennai",
    phone: "+91 44 0000 0000",
  });
  fake.db.taxConfigs.set(RESTAURANT_ID, { cgstPercent: 2.5, sgstPercent: 2.5, serviceChargePercent: 5 });
  fake.db.tables.set(TABLE_ID, { id: TABLE_ID, restaurantId: RESTAURANT_ID, number: 8, capacity: 4, status: "AVAILABLE" });
  fake.db.menuItems.set(MENU_ITEM_ID, {
    id: MENU_ITEM_ID,
    name: "Paneer Tikka",
    price: 280,
    available: true,
    deletedAt: null,
  });
});

function ticketsFor(orderId: string): any[] {
  return Array.from(fake.db.kitchenTickets.values()).filter((t: any) => t.orderId === orderId);
}

// Full golden-path lifecycle: draft -> confirmed -> kitchen -> preparing ->
// ready -> served -> payment pending -> paid -> completed. Exercises the
// REAL orders/kitchen/payments/receipt services against an in-memory fake
// Prisma client (see helpers/fakePrisma.ts) — no live database required.
describe("Order lifecycle (draft -> confirmed -> kitchen -> paid -> completed)", () => {
  it("walks a dine-in order through the full Saffra workflow with correct billing at every step", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const kitchenService = await import("../src/modules/kitchen/kitchen.service.js");
    const paymentsService = await import("../src/modules/payments/payments.service.js");

    // 1. Waiter selects table 8 and opens a new dine-in order.
    let order = await ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId: TABLE_ID, orderType: "DINE_IN" });
    expect(order.status).toBe("DRAFT");
    expect(fake.db.tables.get(TABLE_ID).status).toBe("ORDERING");

    // 2. Add 2x Paneer Tikka (280 each) -> subtotal 560, cgst/sgst 2.5% each, service 5%.
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 2 }, WAITER_ID);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.quantity).toBe(2);
    expect(order.bill.subtotal).toBe(560);
    expect(order.bill.cgst).toBe(14);
    expect(order.bill.sgst).toBe(14);
    expect(order.bill.serviceCharge).toBe(28);
    expect(order.bill.grandTotal).toBe(616); // 560 + 14 + 14 + 28, no rounding needed

    // Adding the same item again increases quantity instead of duplicating the row.
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.quantity).toBe(3);

    // Reduce back to 2 via the quantity control.
    order = await ordersService.updateOrderItem(order.id, order.items[0]!.id, { quantity: 2 }, WAITER_ID);
    expect(order.items[0]!.quantity).toBe(2);
    expect(order.bill.grandTotal).toBe(616);

    // 3. Confirm and send to kitchen.
    order = await ordersService.confirmOrder(order.id, WAITER_ID);
    expect(order.status).toBe("CONFIRMED");

    order = await ordersService.sendToKitchen(order.id, WAITER_ID);
    expect(order.status).toBe("SENT_TO_KITCHEN");
    expect(fake.db.tables.get(TABLE_ID).status).toBe("FOOD_PREPARING");

    const ticket = Array.from(fake.db.kitchenTickets.values()).find((t: any) => t.orderId === order.id);
    expect(ticket).toBeTruthy();
    expect(ticket.status).toBe("NEW");

    // 4. Kitchen accepts, preps, and marks ready — order status tracks the ticket.
    await kitchenService.advanceTicket(ticket.id, CASHIER_ID); // NEW -> ACCEPTED
    let ticketRow = fake.db.kitchenTickets.get(ticket.id);
    expect(ticketRow.status).toBe("ACCEPTED");

    await kitchenService.advanceTicket(ticket.id, CASHIER_ID); // ACCEPTED -> PREPARING
    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("PREPARING");

    await kitchenService.advanceTicket(ticket.id, CASHIER_ID); // PREPARING -> READY
    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("READY");
    expect(fake.db.tables.get(TABLE_ID).status).toBe("READY_TO_SERVE");

    // 5. Waiter serves the table.
    order = await ordersService.markServed(order.id, WAITER_ID);
    expect(order.status).toBe("SERVED");

    // Cannot skip straight to PAID without going through the payment flow.
    expect(() => ordersService.assertTransition("SERVED", "PAID")).toThrow();

    // 6. Cashier opens the payment screen -> Demo checkout -> simulate success.
    const paymentInit = await paymentsService.createPayment(order.id, CASHIER_ID);
    expect(paymentInit.provider).toBe("DEMO");
    expect(paymentInit.providerOrderId).toMatch(/^order_demo_/);
    expect(paymentInit.amount).toBe(616);

    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("PAYMENT_PENDING");
    expect(fake.db.tables.get(TABLE_ID).status).toBe("PAYMENT_PENDING");

    const demoResult = await paymentsService.processDemoPayment(paymentInit.paymentId, "UPI", "success", CASHIER_ID);
    expect(demoResult.state).toBe("CAPTURED");
    expect(demoResult.receiptId).toBeTruthy();

    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("PAID");
    expect(fake.db.tables.get(TABLE_ID).status).toBe("COMPLETED");

    // Idempotency: verifying/processing again must not double-charge or error.
    const secondAttempt = await paymentsService.processDemoPayment(paymentInit.paymentId, "UPI", "success", CASHIER_ID).catch((e) => e);
    // processDemoPayment re-runs finalize which is idempotent on CAPTURED state.
    expect(secondAttempt).not.toBeInstanceOf(Error);

    // 7. Cashier/waiter completes the order and frees the table.
    order = await ordersService.completeOrder(order.id, CASHIER_ID);
    expect(order.status).toBe("COMPLETED");
    expect(fake.db.tables.get(TABLE_ID).status).toBe("AVAILABLE");

    const receipt = fake.db.receipts.get(order.id);
    expect(receipt).toBeTruthy();
    expect(receipt.html).toContain("616.00");
  });

  it("rejects an illegal transition, e.g. completing an order that hasn't been paid", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const freshTableId = "66666666-6666-6666-6666-666666666666";
    fake.db.tables.set(freshTableId, { id: freshTableId, restaurantId: RESTAURANT_ID, number: 9, capacity: 2, status: "AVAILABLE" });

    let order = await ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId: freshTableId, orderType: "DINE_IN" });
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
    order = await ordersService.confirmOrder(order.id, WAITER_ID);

    await expect(ordersService.completeOrder(order.id, WAITER_ID)).rejects.toThrow();
  });

  it("allows adding a second round of items after the order is already SENT_TO_KITCHEN", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const freshTableId = "77777777-7777-7777-7777-777777777777";
    fake.db.tables.set(freshTableId, { id: freshTableId, restaurantId: RESTAURANT_ID, number: 10, capacity: 2, status: "AVAILABLE" });

    let order = await ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId: freshTableId, orderType: "DINE_IN" });
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
    order = await ordersService.confirmOrder(order.id, WAITER_ID);
    order = await ordersService.sendToKitchen(order.id, WAITER_ID);
    expect(order.status).toBe("SENT_TO_KITCHEN");
    expect(order.items[0]!.kitchenStatus).toBe("FIRED");

    // A second round is a normal, allowed edit — not an error. It does NOT
    // merge onto the already-fired line (that would silently sneak an
    // un-reviewed quantity into the kitchen) — it lands as its own new
    // PENDING line, waiting on an explicit "Send to Kitchen".
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 2 }, WAITER_ID);
    expect(order.items).toHaveLength(2);
    expect(order.items[1]!.quantity).toBe(2);
    expect(order.items[1]!.kitchenStatus).toBe("PENDING");
    expect(order.status).toBe("SENT_TO_KITCHEN"); // unaffected — nothing auto-fires

    // Only the explicit send actually fires it.
    order = await ordersService.sendToKitchen(order.id, WAITER_ID);
    expect(order.items[1]!.kitchenStatus).toBe("FIRED");
  });

  it("sends more food as a NEW kitchen round on the same bill, never reopening a sent ticket, and locks the cart once payment starts", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const kitchenService = await import("../src/modules/kitchen/kitchen.service.js");
    const paymentsService = await import("../src/modules/payments/payments.service.js");
    const freshTableId = "88888888-7777-7777-7777-777777777777";
    fake.db.tables.set(freshTableId, { id: freshTableId, restaurantId: RESTAURANT_ID, number: 11, capacity: 2, status: "AVAILABLE" });

    let order = await ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId: freshTableId, orderType: "DINE_IN" });
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
    order = await ordersService.confirmOrder(order.id, WAITER_ID);
    order = await ordersService.sendToKitchen(order.id, WAITER_ID);

    const round1 = ticketsFor(order.id)[0];
    await kitchenService.advanceTicket(round1.id, WAITER_ID); // NEW -> ACCEPTED
    await kitchenService.advanceTicket(round1.id, WAITER_ID); // ACCEPTED -> PREPARING
    await kitchenService.advanceTicket(round1.id, WAITER_ID); // PREPARING -> READY
    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("READY");

    // Customer wants dessert — adding it does NOT touch the kitchen by
    // itself. It just sits as a new PENDING line until the waiter sends it.
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
    expect(order.status).toBe("READY");
    expect(order.items.some((i) => i.kitchenStatus === "PENDING")).toBe(true);

    // Sending it creates round 2. Round 1 is left exactly as it was.
    order = await ordersService.sendToKitchen(order.id, WAITER_ID);
    expect(order.status).toBe("SENT_TO_KITCHEN");
    const rounds = ticketsFor(order.id);
    expect(rounds).toHaveLength(2);
    expect(fake.db.kitchenTickets.get(round1.id).status).toBe("READY");
    const round2 = rounds.find((t: any) => t.id !== round1.id);
    expect(round2.round).toBe(2);
    expect(round2.status).toBe("NEW");
    expect(fake.db.tables.get(freshTableId).status).toBe("FOOD_PREPARING");

    // Fast-forward round 2 to ready -> served. Serving clears both rounds off the board.
    await kitchenService.advanceTicket(round2.id, WAITER_ID);
    await kitchenService.advanceTicket(round2.id, WAITER_ID);
    await kitchenService.advanceTicket(round2.id, WAITER_ID);
    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("READY");
    order = await ordersService.markServed(order.id, WAITER_ID);
    expect(ticketsFor(order.id).every((t: any) => t.status === "COMPLETED")).toBe(true);
    expect(order.bill.subtotal).toBe(560); // both rounds on one bill

    await paymentsService.createPayment(order.id, WAITER_ID);
    await expect(
      ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID),
    ).rejects.toThrow();

    // Customer wants more after all — cancel the (uncharged) pending
    // attempt and add to THIS SAME order/bill, not a second one.
    await paymentsService.cancelPendingPaymentForReorder(order.id, WAITER_ID);
    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("SERVED");

    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
    const totalQuantity = order.items.reduce((sum, i) => sum + i.quantity, 0);
    expect(totalQuantity).toBe(3);
    expect(order.items.at(-1)!.kitchenStatus).toBe("PENDING");

    // Round 3 from a SERVED order puts the order back with the kitchen.
    order = await ordersService.sendToKitchen(order.id, WAITER_ID);
    expect(order.status).toBe("SENT_TO_KITCHEN");
    expect(ticketsFor(order.id)).toHaveLength(3);

    // A brand-new order can never be opened for a table that already has
    // one in flight — the table is one running bill, not several.
    await expect(
      ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId: freshTableId, orderType: "DINE_IN" }),
    ).rejects.toThrow();
  });

  it("each kitchen ticket shows only its own round's food", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const kitchenService = await import("../src/modules/kitchen/kitchen.service.js");
    const freshTableId = "99999999-9999-9999-9999-999999999999";
    fake.db.tables.set(freshTableId, { id: freshTableId, restaurantId: RESTAURANT_ID, number: 12, capacity: 2, status: "AVAILABLE" });

    let order = await ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId: freshTableId, orderType: "DINE_IN" });
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
    order = await ordersService.confirmOrder(order.id, WAITER_ID);
    order = await ordersService.sendToKitchen(order.id, WAITER_ID);

    // A repeat added but not yet sent is invisible to the kitchen.
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 4 }, WAITER_ID);
    let board = (await kitchenService.listActiveTickets(RESTAURANT_ID)).filter((t) => t.orderId === order.id);
    expect(board).toHaveLength(1);
    expect(board[0]!.items).toEqual([expect.objectContaining({ quantity: 1 })]);

    order = await ordersService.sendToKitchen(order.id, WAITER_ID);
    board = (await kitchenService.listActiveTickets(RESTAURANT_ID)).filter((t) => t.orderId === order.id);
    expect(board).toHaveLength(2);
    const byRound = Object.fromEntries(board.map((t) => [t.round, t.items]));
    expect(byRound[1]).toEqual([expect.objectContaining({ quantity: 1 })]);
    expect(byRound[2]).toEqual([expect.objectContaining({ quantity: 4 })]);
  });

  it("locks items once sent: no reducing, re-noting or removing; asking for more becomes a new line", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const freshTableId = "aaaaaaaa-9999-9999-9999-999999999999";
    fake.db.tables.set(freshTableId, { id: freshTableId, restaurantId: RESTAURANT_ID, number: 13, capacity: 2, status: "AVAILABLE" });

    let order = await ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId: freshTableId, orderType: "DINE_IN" });
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 2 }, WAITER_ID);
    order = await ordersService.confirmOrder(order.id, WAITER_ID);
    order = await ordersService.sendToKitchen(order.id, WAITER_ID);
    const sent = order.items[0]!;

    await expect(ordersService.updateOrderItem(order.id, sent.id, { quantity: 1 }, WAITER_ID)).rejects.toThrow(/already gone to the kitchen/);
    await expect(ordersService.updateOrderItem(order.id, sent.id, { notes: "no onion" }, WAITER_ID)).rejects.toThrow(/already gone to the kitchen/);
    await expect(ordersService.removeOrderItem(order.id, sent.id, WAITER_ID)).rejects.toThrow(/already gone to the kitchen/);

    order = await ordersService.updateOrderItem(order.id, sent.id, { quantity: 5 }, WAITER_ID);
    expect(order.items.find((i) => i.id === sent.id)!.quantity).toBe(2);
    const extra = order.items.find((i) => i.id !== sent.id)!;
    expect(extra.quantity).toBe(3);
    expect(extra.kitchenStatus).toBe("PENDING");

    // Unsent lines remain fully editable.
    order = await ordersService.removeOrderItem(order.id, extra.id, WAITER_ID);
    expect(order.items).toHaveLength(1);

    // Cancelling the order takes its food off the kitchen board.
    await ordersService.cancelOrder(order.id, WAITER_ID, "guest left");
    expect(ticketsFor(order.id).every((t: any) => t.status === "COMPLETED")).toBe(true);
  });

  it("the order only reads READY once every round is ready, and the kitchen can keep working after billing starts", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const kitchenService = await import("../src/modules/kitchen/kitchen.service.js");
    const paymentsService = await import("../src/modules/payments/payments.service.js");
    const freshTableId = "bbbbbbbb-9999-9999-9999-999999999999";
    fake.db.tables.set(freshTableId, { id: freshTableId, restaurantId: RESTAURANT_ID, number: 14, capacity: 2, status: "AVAILABLE" });

    let order = await ordersService.createOrder(RESTAURANT_ID, WAITER_ID, { tableId: freshTableId, orderType: "DINE_IN" });
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
    order = await ordersService.confirmOrder(order.id, WAITER_ID);
    order = await ordersService.sendToKitchen(order.id, WAITER_ID);
    const round1 = ticketsFor(order.id)[0];
    await kitchenService.advanceTicket(round1.id, WAITER_ID); // ACCEPTED
    await kitchenService.advanceTicket(round1.id, WAITER_ID); // PREPARING
    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("PREPARING");

    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, WAITER_ID);
    order = await ordersService.sendToKitchen(order.id, WAITER_ID);
    expect(order.status).toBe("SENT_TO_KITCHEN"); // round 2 hasn't been started yet
    const round2 = ticketsFor(order.id).find((t: any) => t.round === 2);

    await kitchenService.advanceTicket(round1.id, WAITER_ID); // round 1 READY
    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("SENT_TO_KITCHEN"); // still waiting on round 2
    await expect(ordersService.markServed(order.id, WAITER_ID)).rejects.toThrow();

    // Cashier bills the table early; the kitchen must still be able to finish round 2.
    await paymentsService.createPayment(order.id, CASHIER_ID);
    await kitchenService.advanceTicket(round2.id, WAITER_ID);
    await kitchenService.advanceTicket(round2.id, WAITER_ID);
    await kitchenService.advanceTicket(round2.id, WAITER_ID);
    expect(fake.db.kitchenTickets.get(round2.id).status).toBe("READY");
    order = await ordersService.getOrder(order.id);
    expect(order.status).toBe("PAYMENT_PENDING");
  });
});

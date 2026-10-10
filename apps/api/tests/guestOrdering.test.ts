import { describe, it, expect, vi, beforeAll } from "vitest";
import { fake } from "./helpers/fakePrisma.js";

vi.mock("../src/lib/prisma.js", () => ({ prisma: fake.prisma }));

const R = "dddddddd-1111-1111-1111-111111111111";
const OTHER_R = "dddddddd-9999-1111-1111-111111111111";
const T5 = "dddddddd-2222-1111-1111-111111111111";
const T6 = "dddddddd-2222-2222-1111-111111111111";
const CAT = "dddddddd-5555-1111-1111-111111111111";
const DOSA = "dddddddd-3333-1111-1111-111111111111";
const COFFEE = "dddddddd-3333-2222-1111-111111111111";
const OFF_MENU = "dddddddd-3333-3333-1111-111111111111";
const FOREIGN = "dddddddd-3333-4444-1111-111111111111";
const STAFF = "dddddddd-4444-1111-1111-111111111111";

beforeAll(() => {
  fake.db.restaurants.set(R, { id: R, name: "Spice Garden", invoicePrefix: "SG", receiptFooter: "Thanks!", timezone: "Asia/Kolkata", currency: "INR" });
  fake.db.taxConfigs.set(R, { cgstPercent: 2.5, sgstPercent: 2.5, serviceChargePercent: 5 });
  fake.db.tables.set(T5, { id: T5, restaurantId: R, number: 5, capacity: 4, status: "AVAILABLE", qrToken: null, deletedAt: null });
  fake.db.tables.set(T6, { id: T6, restaurantId: R, number: 6, capacity: 4, status: "AVAILABLE", qrToken: null, deletedAt: null });
  fake.db.categories.set(CAT, { id: CAT, restaurantId: R, name: "South Indian", sortOrder: 0 });
  const item = (id: string, name: string, price: number, extra: object = {}) =>
    fake.db.menuItems.set(id, { id, restaurantId: R, categoryId: CAT, name, description: "", price, foodType: "VEG", available: true, deletedAt: null, ...extra });
  item(DOSA, "Masala Dosa", 120);
  item(COFFEE, "Filter Coffee", 50);
  item(OFF_MENU, "Rava Dosa", 130, { available: false });
  item(FOREIGN, "Somebody Else's Dish", 999, { restaurantId: OTHER_R });
});

async function tokenFor(tableNumber: number) {
  const guest = await import("../src/modules/guestOrdering/guestOrdering.service.js");
  const codes = await guest.listTableQrCodes(R);
  return codes.find((c) => c.number === tableNumber)!.qrToken;
}

describe("table QR codes", () => {
  it("gives every table its own unguessable code, stable until regenerated", async () => {
    const guest = await import("../src/modules/guestOrdering/guestOrdering.service.js");
    const first = await guest.listTableQrCodes(R);
    const again = await guest.listTableQrCodes(R);
    expect(first.map((c) => c.qrToken)).toEqual(again.map((c) => c.qrToken));
    expect(new Set(first.map((c) => c.qrToken)).size).toBe(first.length);
    expect(first[0]!.qrToken.length).toBeGreaterThanOrEqual(16);

    const old = first.find((c) => c.number === 6)!.qrToken;
    const fresh = await guest.regenerateTableQr(T6, STAFF);
    expect(fresh.qrToken).not.toBe(old);
    await expect(guest.getGuestMenu(old)).rejects.toThrow(/isn't valid/);
  });

  it("shows the guest the menu for their table, including what's sold out", async () => {
    const guest = await import("../src/modules/guestOrdering/guestOrdering.service.js");
    const menu = await guest.getGuestMenu(await tokenFor(5));
    expect(menu.table.number).toBe(5);
    expect(menu.restaurant.name).toBe("Spice Garden");
    const names = menu.categories.flatMap((c) => c.items.map((i) => `${i.name}:${i.available}`));
    expect(names).toContain("Rava Dosa:false");
  });
});

describe("guest order → staff → kitchen", () => {
  it("a guest's order waits for staff, then joins the table's bill and goes to the kitchen", async () => {
    const guest = await import("../src/modules/guestOrdering/guestOrdering.service.js");
    const token = await tokenFor(5);

    const { requestId } = await guest.createGuestOrderRequest(token, {
      items: [{ menuItemId: DOSA, quantity: 2, notes: "less spicy" }, { menuItemId: COFFEE, quantity: 1 }],
      guestName: "Meena",
      guestPhone: "98765 00001",
    });

    // Nothing has reached the kitchen or the table yet.
    expect(Array.from(fake.db.orders.values()).filter((o: any) => o.tableId === T5)).toHaveLength(0);
    const pending = await guest.listPendingRequests(R);
    expect(pending).toEqual([expect.objectContaining({ id: requestId, tableNumber: 5, estimatedTotal: 290, guestName: "Meena" })]);

    let status = await guest.getGuestStatus(token);
    expect(status.requests[0]).toMatchObject({ status: "PENDING", items: [{ name: "Masala Dosa", quantity: 2 }, { name: "Filter Coffee", quantity: 1 }] });
    expect(status.order).toBeNull();

    const { orderId } = await guest.acceptRequest(requestId, R, STAFF);
    const order = fake.db.orders.get(orderId!);
    expect(order.status).toBe("SENT_TO_KITCHEN");
    expect(order.customerId).toBeTruthy(); // guest gave a phone number → linked for loyalty
    const ticket = Array.from(fake.db.kitchenTickets.values()).find((t: any) => t.orderId === orderId);
    expect(ticket).toBeTruthy();
    const lines = Array.from(fake.db.orderItems.values()).filter((i: any) => i.orderId === orderId);
    expect(lines.every((l: any) => l.kitchenStatus === "FIRED")).toBe(true);
    expect(lines.find((l: any) => l.menuItemId === DOSA).notes).toBe("less spicy");

    status = await guest.getGuestStatus(token);
    expect(status.requests[0]!.status).toBe("ACCEPTED");
    expect(status.order?.items.map((i) => i.kitchenStatus)).toEqual(["FIRED", "FIRED"]);
    expect(JSON.stringify(status)).not.toContain("98765"); // no personal details on the public screen

    // Can't be accepted twice (two waiters tapping at once).
    await expect(guest.acceptRequest(requestId, R, STAFF)).rejects.toThrow(/already handled/);

    // Ordering again from the same table = a new kitchen round on the SAME bill.
    const second = await guest.createGuestOrderRequest(token, { items: [{ menuItemId: COFFEE, quantity: 2 }] });
    const accepted = await guest.acceptRequest(second.requestId, R, STAFF);
    expect(accepted.orderId).toBe(orderId);
    expect(Array.from(fake.db.kitchenTickets.values()).filter((t: any) => t.orderId === orderId)).toHaveLength(2);
  });

  it("rejects sold-out, off-menu and other restaurants' dishes", async () => {
    const guest = await import("../src/modules/guestOrdering/guestOrdering.service.js");
    const token = await tokenFor(6);
    await expect(guest.createGuestOrderRequest(token, { items: [{ menuItemId: OFF_MENU, quantity: 1 }] })).rejects.toThrow(/not available/);
    await expect(guest.createGuestOrderRequest(token, { items: [{ menuItemId: FOREIGN, quantity: 1 }] })).rejects.toThrow(/no longer on the menu/);
  });

  it("limits how many unanswered orders one table can pile up", async () => {
    const guest = await import("../src/modules/guestOrdering/guestOrdering.service.js");
    const token = await tokenFor(6);
    for (let i = 0; i < 3; i++) await guest.createGuestOrderRequest(token, { items: [{ menuItemId: DOSA, quantity: 1 }] });
    await expect(guest.createGuestOrderRequest(token, { items: [{ menuItemId: DOSA, quantity: 1 }] })).rejects.toThrow(/still waiting/);
  });

  it("staff can decline with a reason the guest sees; nothing reaches the kitchen", async () => {
    const guest = await import("../src/modules/guestOrdering/guestOrdering.service.js");
    const token = await tokenFor(6);
    const pending = (await guest.listPendingRequests(R)).filter((r) => r.tableNumber === 6);
    await guest.declineRequest(pending[0]!.id, R, STAFF, "Kitchen closes at 11");
    const status = await guest.getGuestStatus(token);
    expect(status.requests.find((r) => r.id === pending[0]!.id)).toMatchObject({ status: "DECLINED", declineReason: "Kitchen closes at 11" });
    expect(Array.from(fake.db.orders.values()).filter((o: any) => o.tableId === T6)).toHaveLength(0);
  });

  it("asking for the bill creates one alert, not one per tap", async () => {
    const guest = await import("../src/modules/guestOrdering/guestOrdering.service.js");
    const token = await tokenFor(5);
    const a = await guest.requestBill(token);
    const b = await guest.requestBill(token);
    expect(a.requestId).toBe(b.requestId);
    const bills = (await guest.listPendingRequests(R)).filter((r) => r.kind === "BILL");
    expect(bills).toHaveLength(1);
    await guest.acceptRequest(a.requestId, R, STAFF);
  });

  it("staff of another restaurant can't act on these requests", async () => {
    const guest = await import("../src/modules/guestOrdering/guestOrdering.service.js");
    const token = await tokenFor(5);
    const { requestId } = await guest.createGuestOrderRequest(token, { items: [{ menuItemId: DOSA, quantity: 1 }] });
    await expect(guest.acceptRequest(requestId, OTHER_R, STAFF)).rejects.toThrow(/not found/);
    await expect(guest.declineRequest(requestId, OTHER_R, STAFF)).rejects.toThrow(/not found/);
  });
});

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { fake } from "./helpers/fakePrisma.js";

vi.mock("../src/lib/prisma.js", () => ({ prisma: fake.prisma }));

const RESTAURANT_ID = "cccccccc-1111-1111-1111-111111111111";
const TABLE_ID = "cccccccc-2222-1111-1111-111111111111";
const MENU_ITEM_ID = "cccccccc-3333-1111-1111-111111111111";
const ADMIN_ID = "cccccccc-4444-1111-1111-111111111111";

const KEY_ID = "rzp_test_Abc123XYZ";
const KEY_SECRET = "s3cr3t_value_from_dashboard";

const respond = (status: number) => (async () => new Response("{}", { status })) as unknown as typeof fetch;
const offline = (async () => {
  throw new TypeError("fetch failed");
}) as unknown as typeof fetch;

beforeAll(() => {
  fake.db.restaurants.set(RESTAURANT_ID, { id: RESTAURANT_ID, name: "Saffra Bistro", invoicePrefix: "SAF", receiptFooter: "Thanks!", timezone: "Asia/Kolkata" });
  fake.db.taxConfigs.set(RESTAURANT_ID, { cgstPercent: 2.5, sgstPercent: 2.5, serviceChargePercent: 5 });
  fake.db.tables.set(TABLE_ID, { id: TABLE_ID, restaurantId: RESTAURANT_ID, number: 1, capacity: 4, status: "AVAILABLE" });
  fake.db.menuItems.set(MENU_ITEM_ID, { id: MENU_ITEM_ID, name: "Masala Dosa", price: 120, available: true, deletedAt: null });
});

beforeEach(async () => {
  fake.db.paymentGateways.clear();
  const { invalidatePaymentGatewayCache } = await import("../src/modules/payments/providers/index.js");
  invalidatePaymentGatewayCache();
});

describe("secretBox", () => {
  it("round-trips, hides the plaintext, and rejects tampering", async () => {
    const { sealSecret, openSecret } = await import("../src/lib/secretBox.js");
    const sealed = sealSecret(KEY_SECRET);
    expect(sealed).not.toContain(KEY_SECRET);
    expect(openSecret(sealed)).toBe(KEY_SECRET);
    expect(sealSecret(KEY_SECRET)).not.toBe(sealed); // fresh IV every time

    const parts = sealed.split(":");
    const flipped = Buffer.from(parts[3]!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    parts[3] = flipped.toString("base64");
    expect(() => openSecret(parts.join(":"))).toThrow();
  });
});

describe("restaurant's own Razorpay keys", () => {
  it("rejects something that isn't a Razorpay key id, without contacting Razorpay", async () => {
    const { savePaymentGateway } = await import("../src/modules/settings/paymentGateway.service.js");
    const fetchSpy = vi.fn(respond(200));
    await expect(savePaymentGateway(RESTAURANT_ID, { keyId: "abc", keySecret: KEY_SECRET }, ADMIN_ID, fetchSpy)).rejects.toThrow(/rzp_test_/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fake.db.paymentGateways.size).toBe(0);
  });

  it("refuses keys Razorpay rejects and stores nothing", async () => {
    const { savePaymentGateway } = await import("../src/modules/settings/paymentGateway.service.js");
    await expect(savePaymentGateway(RESTAURANT_ID, { keyId: KEY_ID, keySecret: KEY_SECRET }, ADMIN_ID, respond(401))).rejects.toThrow(
      /didn't accept/,
    );
    expect(fake.db.paymentGateways.size).toBe(0);
  });

  it("saves accepted keys encrypted, switches new payments to Razorpay, and never exposes or logs the secret", async () => {
    const { savePaymentGateway } = await import("../src/modules/settings/paymentGateway.service.js");
    const { getActivePaymentProvider } = await import("../src/modules/payments/providers/index.js");
    const { getSettings } = await import("../src/modules/settings/settings.service.js");

    const result = await savePaymentGateway(RESTAURANT_ID, { keyId: ` ${KEY_ID} `, keySecret: KEY_SECRET }, ADMIN_ID, respond(200));
    expect(result.verified).toBe(true);
    expect(result.status).toMatchObject({ source: "SETTINGS", provider: "RAZORPAY_TEST", keyId: KEY_ID, mode: "TEST" });
    expect(JSON.stringify(result)).not.toContain(KEY_SECRET);

    const row = fake.db.paymentGateways.get(RESTAURANT_ID);
    expect(row.keySecretEnc).not.toContain(KEY_SECRET);

    const provider = await getActivePaymentProvider();
    expect(provider.kind).toBe("RAZORPAY_TEST");
    expect(provider.publicKeyId).toBe(KEY_ID);

    const settings = await getSettings();
    expect(settings.payment).toMatchObject({ provider: "RAZORPAY_TEST", razorpayConfigured: true, keyId: KEY_ID });
    expect(JSON.stringify(settings)).not.toContain(KEY_SECRET);
    expect(JSON.stringify(fake.db.auditLogs)).not.toContain(KEY_SECRET);
  });

  it("saves keys while offline as 'not confirmed yet' instead of blocking setup", async () => {
    const { savePaymentGateway, recheckPaymentGateway } = await import("../src/modules/settings/paymentGateway.service.js");
    const saved = await savePaymentGateway(RESTAURANT_ID, { keyId: KEY_ID, keySecret: KEY_SECRET }, ADMIN_ID, offline);
    expect(saved.verified).toBe(false);
    expect(saved.status.verifiedAt).toBeNull();
    expect(saved.status.provider).toBe("RAZORPAY_TEST");

    const rechecked = await recheckPaymentGateway(RESTAURANT_ID, respond(200));
    expect(rechecked.verified).toBe(true);
    expect(rechecked.status.verifiedAt).not.toBeNull();
  });

  it("never falls back to Demo when saved keys can't be decrypted", async () => {
    const { getActivePaymentProvider } = await import("../src/modules/payments/providers/index.js");
    fake.db.paymentGateways.set(RESTAURANT_ID, { id: "x", restaurantId: RESTAURANT_ID, keyId: KEY_ID, keySecretEnc: "v1:bad:bad:bad", mode: "TEST" });
    await expect(getActivePaymentProvider()).rejects.toThrow(/enter your Razorpay keys again/);
  });

  it("removing keys returns to Demo mode", async () => {
    const { savePaymentGateway, removePaymentGateway } = await import("../src/modules/settings/paymentGateway.service.js");
    await savePaymentGateway(RESTAURANT_ID, { keyId: KEY_ID, keySecret: KEY_SECRET }, ADMIN_ID, respond(200));
    const status = await removePaymentGateway(RESTAURANT_ID, ADMIN_ID);
    expect(status.provider).toBe("DEMO");
  });
});

describe("payments keep using the provider that created them", () => {
  it("a demo payment is still verified by Demo after Razorpay keys are added", async () => {
    const { savePaymentGateway } = await import("../src/modules/settings/paymentGateway.service.js");
    const { getProviderForPayment } = await import("../src/modules/payments/providers/index.js");
    await savePaymentGateway(RESTAURANT_ID, { keyId: KEY_ID, keySecret: KEY_SECRET }, ADMIN_ID, respond(200));
    expect((await getProviderForPayment("DEMO")).kind).toBe("DEMO");
    expect((await getProviderForPayment("RAZORPAY_TEST")).kind).toBe("RAZORPAY_TEST");
    await expect(getProviderForPayment("RAZORPAY_LIVE")).rejects.toThrow(/different Razorpay keys/);
  });

  it("an unfinished Razorpay attempt is cancelled (not left blocking the bill) once the keys are removed", async () => {
    const ordersService = await import("../src/modules/orders/orders.service.js");
    const paymentsService = await import("../src/modules/payments/payments.service.js");

    let order = await ordersService.createOrder(RESTAURANT_ID, ADMIN_ID, { tableId: TABLE_ID, orderType: "DINE_IN" });
    order = await ordersService.addOrderItem(order.id, { menuItemId: MENU_ITEM_ID, quantity: 1 }, ADMIN_ID);
    order = await ordersService.confirmOrder(order.id, ADMIN_ID);
    order = await ordersService.sendToKitchen(order.id, ADMIN_ID);

    // An attempt that was started on Razorpay before the keys were removed.
    const stale = await fake.prisma.payment.create({
      data: { orderId: order.id, provider: "RAZORPAY_TEST", providerOrderId: "order_rzp_stale", amount: order.bill.grandTotal, state: "INITIATED" },
    });

    const fresh = await paymentsService.createPayment(order.id, ADMIN_ID);
    expect(fresh.provider).toBe("DEMO");
    expect(fresh.paymentId).not.toBe(stale.id);
    expect(fake.db.payments.get(stale.id).state).toBe("CANCELLED");
  });
});

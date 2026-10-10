import { PrismaClient } from "@prisma/client";
import { buildSeedBundle, buildReceiptHtmlForOrder } from "./seed-data.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Building seed data set...");
  const bundle = await buildSeedBundle();

  console.log("Seeding restaurant...");
  const restaurant = await prisma.restaurant.create({
    data: {
      id: bundle.restaurant.id,
      name: bundle.restaurant.name,
      address: bundle.restaurant.address,
      city: bundle.restaurant.city,
      gstin: bundle.restaurant.gstin,
      phone: bundle.restaurant.phone,
      email: bundle.restaurant.email,
      invoicePrefix: bundle.restaurant.invoicePrefix,
      receiptFooter: bundle.restaurant.receiptFooter,
      // Seeded demo data stands in for a finished onboarding wizard run.
      onboardingCompletedAt: new Date(),
    },
  });

  await prisma.taxConfiguration.create({
    data: {
      restaurantId: restaurant.id,
      cgstPercent: bundle.taxConfig.cgstPercent,
      sgstPercent: bundle.taxConfig.sgstPercent,
      serviceChargePercent: bundle.taxConfig.serviceChargePercent,
    },
  });

  console.log(`Seeding ${bundle.categories.length} categories...`);
  await prisma.menuCategory.createMany({
    data: bundle.categories.map((c) => ({ id: c.id, restaurantId: restaurant.id, name: c.name, sortOrder: c.sortOrder })),
  });

  console.log(`Seeding ${bundle.menuItems.length} menu items...`);
  await prisma.menuItem.createMany({
    data: bundle.menuItems.map((m) => ({
      id: m.id,
      restaurantId: restaurant.id,
      categoryId: m.categoryId,
      name: m.name,
      description: m.description,
      price: m.price,
      foodType: m.foodType,
      featured: m.featured,
      popular: m.popular,
      available: true,
    })),
  });

  console.log(`Seeding ${bundle.tables.length} tables...`);
  await prisma.restaurantTable.createMany({
    data: bundle.tables.map((t) => ({
      id: t.id,
      restaurantId: restaurant.id,
      number: t.number,
      capacity: t.capacity,
      status: t.status as any,
    })),
  });

  console.log(`Seeding ${bundle.staff.length} staff members...`);
  await prisma.user.createMany({
    data: bundle.staff.map((s) => ({
      id: s.id,
      restaurantId: restaurant.id,
      employeeId: s.employeeId,
      name: s.name,
      role: s.role,
      phone: s.phone,
      email: s.email,
      passwordHash: s.passwordHash,
    })),
  });

  // Order status -> where its (single, seeded) kitchen round would be.
  const SEED_TICKET_STATUS: Record<string, string> = {
    SENT_TO_KITCHEN: "NEW",
    PREPARING: "PREPARING",
    READY: "READY",
  };

  console.log(`Seeding ${bundle.orders.length} orders (with items, kitchen tickets, payments, receipts)...`);
  for (const order of bundle.orders) {
    await prisma.order.create({
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        status: order.status as any,
        restaurantId: restaurant.id,
        tableId: order.tableId,
        waiterId: order.waiterId,
        note: order.note,
        subtotal: order.subtotal,
        cgst: order.cgst,
        sgst: order.sgst,
        serviceCharge: order.serviceCharge,
        discountAmount: order.discountAmount,
        discountReason: order.discountReason,
        roundOff: order.roundOff,
        grandTotal: order.grandTotal,
        createdAt: order.createdAt,
        confirmedAt: order.confirmedAt,
        completedAt: order.completedAt,
        items: {
          create: order.items.map((i) => ({
            id: i.id,
            menuItemId: i.menuItemId,
            nameSnapshot: i.nameSnapshot,
            priceSnapshot: i.priceSnapshot,
            quantity: i.quantity,
            notes: i.notes,
          })),
        },
      },
    });

    if (order.kitchenTicket) {
      // Keep the seeded kitchen state consistent with the order's status, so
      // the Kitchen board shows real food on each ticket and served history
      // is already locked, exactly as if it had gone through the app.
      const ticketStatus = SEED_TICKET_STATUS[order.status] ?? "COMPLETED";
      const ticket = await prisma.kitchenTicket.create({
        data: {
          orderId: order.id,
          round: 1,
          ticketNumber: `KOT-${order.orderNumber.slice(-5)}`,
          status: ticketStatus,
        },
      });
      await prisma.orderItem.updateMany({
        where: { orderId: order.id },
        data: { kitchenTicketId: ticket.id, kitchenStatus: ticketStatus === "COMPLETED" ? "SERVED" : "FIRED" },
      });
    }

    if (order.payment) {
      const payment = await prisma.payment.create({
        data: {
          id: order.payment.id,
          orderId: order.id,
          provider: order.payment.provider,
          providerOrderId: order.payment.providerOrderId,
          providerPaymentId: order.payment.providerPaymentId,
          method: order.payment.method,
          amount: order.payment.amount,
          state: order.payment.state,
          cashierId: order.payment.cashierId,
          capturedAt: order.payment.capturedAt,
        },
      });

      if (order.payment.state === "CAPTURED") {
        await prisma.receipt.create({
          data: {
            orderId: order.id,
            paymentId: payment.id,
            receiptNumber: `${bundle.restaurant.invoicePrefix}-RCPT-${order.orderNumber.slice(-6)}`,
            html: buildReceiptHtmlForOrder(bundle, order)!,
          },
        });
      }
    }
  }

  console.log("Seed complete.");
  console.log("Demo logins: WTR001 / CSH001 / MGR001 / ADM001 — password: password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KitchenTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "ticketNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "readyAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "KitchenTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_KitchenTicket" ("acceptedAt", "completedAt", "createdAt", "id", "orderId", "readyAt", "status", "ticketNumber", "updatedAt") SELECT "acceptedAt", "completedAt", "createdAt", "id", "orderId", "readyAt", "status", "ticketNumber", "updatedAt" FROM "KitchenTicket";
DROP TABLE "KitchenTicket";
ALTER TABLE "new_KitchenTicket" RENAME TO "KitchenTicket";
CREATE INDEX "KitchenTicket_status_idx" ON "KitchenTicket"("status");
CREATE INDEX "KitchenTicket_orderId_idx" ON "KitchenTicket"("orderId");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "kitchenStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "kitchenTicketId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_kitchenTicketId_fkey" FOREIGN KEY ("kitchenTicketId") REFERENCES "KitchenTicket" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("createdAt", "id", "kitchenStatus", "menuItemId", "nameSnapshot", "notes", "orderId", "priceSnapshot", "quantity", "updatedAt") SELECT "createdAt", "id", "kitchenStatus", "menuItemId", "nameSnapshot", "notes", "orderId", "priceSnapshot", "quantity", "updatedAt" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_kitchenTicketId_idx" ON "OrderItem"("kitchenTicketId");
-- Backfill: before this migration an order had at most one ticket, so every
-- line already sent to the kitchen (FIRED/SERVED) belongs to that ticket.
UPDATE "OrderItem" SET "kitchenTicketId" = (
    SELECT "id" FROM "KitchenTicket" WHERE "KitchenTicket"."orderId" = "OrderItem"."orderId"
) WHERE "kitchenStatus" IN ('FIRED', 'SERVED');
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- AlterTable
ALTER TABLE "RestaurantTable" ADD COLUMN "qrToken" TEXT;

-- CreateTable
CREATE TABLE "GuestRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ORDER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "items" TEXT NOT NULL DEFAULT '[]',
    "note" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "customerId" TEXT,
    "orderId" TEXT,
    "handledById" TEXT,
    "declineReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" DATETIME,
    CONSTRAINT "GuestRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuestRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuestRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GuestRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "earnPercent" DECIMAL NOT NULL DEFAULT 5,
    "pointValue" DECIMAL NOT NULL DEFAULT 1,
    "minBillToEarn" DECIMAL NOT NULL DEFAULT 0,
    "redeemMinPoints" INTEGER NOT NULL DEFAULT 100,
    "maxRedeemPercent" DECIMAL NOT NULL DEFAULT 50,
    "expiryDays" INTEGER NOT NULL DEFAULT 365,
    "excludedCategoryIds" TEXT NOT NULL DEFAULT '[]',
    "visitBonusEvery" INTEGER NOT NULL DEFAULT 0,
    "visitBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "welcomeBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoyaltyProgram_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSpend" DECIMAL NOT NULL DEFAULT 0,
    "minVisits" INTEGER NOT NULL DEFAULT 0,
    "earnPercent" DECIMAL NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#D63A5E',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LoyaltyTier_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoyaltyLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "note" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyLedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LoyaltyLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("createdAt", "id", "name", "phone", "restaurantId", "updatedAt", "visitCount") SELECT "createdAt", "id", "name", "phone", "restaurantId", "updatedAt", "visitCount" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE INDEX "Customer_restaurantId_idx" ON "Customer"("restaurantId");
CREATE UNIQUE INDEX "Customer_restaurantId_phone_key" ON "Customer"("restaurantId", "phone");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "orderType" TEXT NOT NULL DEFAULT 'DINE_IN',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "cgst" DECIMAL NOT NULL DEFAULT 0,
    "sgst" DECIMAL NOT NULL DEFAULT 0,
    "serviceCharge" DECIMAL NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "loyaltyDiscount" DECIMAL NOT NULL DEFAULT 0,
    "roundOff" DECIMAL NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL NOT NULL DEFAULT 0,
    "customerName" TEXT,
    "customerId" TEXT,
    "publicPayToken" TEXT,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT,
    "waiterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "confirmedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("cancelledAt", "cgst", "completedAt", "confirmedAt", "createdAt", "customerId", "customerName", "discountAmount", "discountReason", "grandTotal", "id", "note", "orderNumber", "orderType", "publicPayToken", "restaurantId", "roundOff", "serviceCharge", "sgst", "status", "subtotal", "tableId", "updatedAt", "waiterId") SELECT "cancelledAt", "cgst", "completedAt", "confirmedAt", "createdAt", "customerId", "customerName", "discountAmount", "discountReason", "grandTotal", "id", "note", "orderNumber", "orderType", "publicPayToken", "restaurantId", "roundOff", "serviceCharge", "sgst", "status", "subtotal", "tableId", "updatedAt", "waiterId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_publicPayToken_key" ON "Order"("publicPayToken");
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");
CREATE INDEX "Order_waiterId_idx" ON "Order"("waiterId");
CREATE INDEX "Order_tableId_idx" ON "Order"("tableId");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GuestRequest_restaurantId_status_idx" ON "GuestRequest"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "GuestRequest_tableId_idx" ON "GuestRequest"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_restaurantId_key" ON "LoyaltyProgram"("restaurantId");

-- CreateIndex
CREATE INDEX "LoyaltyTier_restaurantId_idx" ON "LoyaltyTier"("restaurantId");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_customerId_idx" ON "LoyaltyLedgerEntry"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyLedgerEntry_orderId_type_key" ON "LoyaltyLedgerEntry"("orderId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_qrToken_key" ON "RestaurantTable"("qrToken");


-- Backfill: lifetime spend for existing customers from their paid bills.
UPDATE "Customer" SET "totalSpent" = (
    SELECT COALESCE(SUM("grandTotal"), 0) FROM "Order"
    WHERE "Order"."customerId" = "Customer"."id" AND "Order"."status" IN ('PAID', 'COMPLETED')
);

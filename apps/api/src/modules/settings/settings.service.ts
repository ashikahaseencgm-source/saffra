import { prisma } from "../../lib/prisma.js";
import { getPaymentGatewayStatus } from "./paymentGateway.service.js";
import { setLocalHostname, toLocalHostname } from "../../lib/localName.js";
import type { TaxConfigInput } from "../billing/billingEngine.js";

export async function getOrCreateRestaurant() {
  let restaurant = await prisma.restaurant.findFirst();
  if (!restaurant) {
    restaurant = await prisma.restaurant.create({ data: {} });
  }
  return restaurant;
}

/** The .local name this install announces: the custom one if set, else derived from the restaurant name. */
export function effectiveLocalHostname(restaurant: { name: string; localHostname: string | null } | null): string {
  if (!restaurant) return "saffra";
  return restaurant.localHostname || toLocalHostname(restaurant.name);
}

/** Re-reads the restaurant and updates the name announced on the Wi-Fi. */
export async function refreshLocalHostname(): Promise<void> {
  const restaurant = await prisma.restaurant.findFirst();
  setLocalHostname(effectiveLocalHostname(restaurant));
}

export async function getTaxConfig(restaurantId: string): Promise<TaxConfigInput> {
  const config = await prisma.taxConfiguration.upsert({
    where: { restaurantId },
    create: { restaurantId },
    update: {},
  });
  return {
    cgstPercent: Number(config.cgstPercent),
    sgstPercent: Number(config.sgstPercent),
    serviceChargePercent: Number(config.serviceChargePercent),
  };
}

export async function updateTaxConfig(restaurantId: string, data: Partial<TaxConfigInput>) {
  const config = await prisma.taxConfiguration.upsert({
    where: { restaurantId },
    create: { restaurantId, ...data },
    update: data,
  });
  return config;
}

export async function getSettings() {
  const restaurant = await getOrCreateRestaurant();
  const taxConfig = await getTaxConfig(restaurant.id);
  const gateway = await getPaymentGatewayStatus();
  const razorpayConfigured = gateway.provider !== "DEMO";
  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      address: restaurant.address,
      city: restaurant.city,
      gstin: restaurant.gstin,
      phone: restaurant.phone,
      email: restaurant.email,
      currency: restaurant.currency,
      timezone: restaurant.timezone,
      invoicePrefix: restaurant.invoicePrefix,
      receiptFooter: restaurant.receiptFooter,
      // Custom Wi-Fi name, or null when it follows the restaurant name.
      localHostname: restaurant.localHostname,
      effectiveLocalHostname: effectiveLocalHostname(restaurant),
    },
    taxConfig,
    payment: {
      provider: gateway.provider,
      razorpayConfigured,
      keyId: gateway.keyId,
      needsAttention: gateway.source === "UNREADABLE",
      statusLabel: razorpayConfigured
        ? gateway.provider === "RAZORPAY_LIVE"
          ? "Razorpay Live Mode"
          : "Razorpay Test Mode"
        : "Demo Mode Active",
    },
  };
}

export async function updateSettings(restaurantId: string, data: Record<string, unknown>) {
  const { taxConfig, ...restaurantFields } = data as { taxConfig?: Partial<TaxConfigInput> } & Record<string, unknown>;
  await prisma.restaurant.update({ where: { id: restaurantId }, data: restaurantFields as any });
  if (taxConfig) await updateTaxConfig(restaurantId, taxConfig);
  if ("name" in restaurantFields || "localHostname" in restaurantFields) await refreshLocalHostname();
  return getSettings();
}

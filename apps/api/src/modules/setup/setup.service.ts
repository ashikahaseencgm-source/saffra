import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { recordAudit } from "../audit/auditService.js";
import { login } from "../auth/auth.service.js";
import { loadStarterMenu } from "./starterMenu.js";
import { env } from "../../config/env.js";
import { lanAddresses, primaryLanAddress } from "../../lib/lanAddress.js";
import { getLocalHostname, isLocalNameActive } from "../../lib/localName.js";
import { networkState } from "../../lib/networkState.js";
import { refreshLocalHostname } from "../settings/settings.service.js";
import type { CompleteSetupInput } from "./setup.schema.js";

/**
 * How other devices on the restaurant's Wi-Fi reach this computer, so the
 * app can tell staff exactly what to open on their phone/tablet:
 * - nameUrl: easy to type, e.g. http://spice-garden.local (mDNS; see
 *   lib/localName.ts). Null when the name service isn't running.
 * - ipUrl: the numeric address, e.g. http://192.168.1.42 — works on every
 *   device, so it's what QR codes point at.
 * Ports are left out of both when the no-port listener (80) is active.
 */
export function getNetworkInfo() {
  const portSuffix = networkState.friendlyPort === 80 ? "" : `:${networkState.friendlyPort ?? env.PORT}`;
  const ip = primaryLanAddress();
  const hostname = getLocalHostname();
  return {
    addresses: lanAddresses(),
    port: env.PORT,
    hostname: hostname ? `${hostname}.local` : null,
    nameUrl: hostname && isLocalNameActive() ? `http://${hostname}.local${portSuffix}` : null,
    ipUrl: ip ? `http://${ip}${portSuffix}` : null,
  };
}

/** Is there a restaurant that's finished the first-run onboarding wizard? */
export async function getSetupStatus() {
  const restaurant = await prisma.restaurant.findFirst();
  return { needsOnboarding: !restaurant?.onboardingCompletedAt };
}

/**
 * Runs exactly once per install. Creates the restaurant profile, tax
 * config, the first (admin) staff account, the table layout, and optionally
 * a starter menu — then logs the new admin straight in, the same way
 * auth.service.login does, so onboarding ends on the Dashboard rather than
 * bouncing back to a login screen for credentials the person just typed.
 */
export async function completeSetup(input: CompleteSetupInput, meta: { ip?: string; userAgent?: string }) {
  const existing = await prisma.restaurant.findFirst();
  if (existing?.onboardingCompletedAt) {
    throw AppError.conflict("Setup has already been completed on this install.");
  }

  const employeeIdTaken = await prisma.user.findUnique({ where: { employeeId: input.admin.employeeId } });
  if (employeeIdTaken) {
    throw AppError.conflict(`Employee ID ${input.admin.employeeId} is already in use`);
  }

  const restaurant = existing
    ? await prisma.restaurant.update({
        where: { id: existing.id },
        data: { ...input.restaurant, onboardingCompletedAt: new Date() },
      })
    : await prisma.restaurant.create({
        data: { ...input.restaurant, onboardingCompletedAt: new Date() },
      });

  await prisma.taxConfiguration.upsert({
    where: { restaurantId: restaurant.id },
    create: { restaurantId: restaurant.id, ...input.tax },
    update: input.tax,
  });

  const passwordHash = await bcrypt.hash(input.admin.password, 10);
  const admin = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      employeeId: input.admin.employeeId,
      name: input.admin.name,
      role: "ADMIN",
      passwordHash,
      // The person running onboarding just watched (or will watch) the
      // tour's cues as part of the wizard itself, no need to show it again
      // the moment they land on the Dashboard.
      tourCompletedAt: new Date(),
    },
  });

  await prisma.restaurantTable.createMany({
    data: Array.from({ length: input.tableCount }, (_, i) => ({
      restaurantId: restaurant.id,
      number: i + 1,
      capacity: 4,
    })),
  });

  if (input.loadSampleMenu) {
    await loadStarterMenu(restaurant.id);
  }

  await recordAudit({
    userId: admin.id,
    action: "ONBOARDING_COMPLETED",
    entity: "Restaurant",
    entityId: restaurant.id,
    metadata: { tableCount: input.tableCount, loadSampleMenu: input.loadSampleMenu },
  });

  await refreshLocalHostname();
  return login(input.admin.employeeId, input.admin.password, meta);
}

import makeMdns from "multicast-dns";
import { logger } from "./logger.js";
import { lanAddressFacing } from "./lanAddress.js";

/**
 * Lets staff open Saffra at http://<restaurant-name>.local instead of a
 * numeric address like http://192.168.1.42:4000.
 *
 * It's a tiny mDNS responder (the same mechanism printers, Macs and
 * Chromecasts use to be found by name on a local network): when a device on
 * the Wi-Fi asks "who is saffra-bistro.local?", this computer answers with its
 * own LAN address. No router setup and no internet needed.
 *
 * Works on iPhone/iPad, Mac, Windows 10+, Linux and most newer Android
 * phones. Older Android browsers can't look up ".local" names at all, which
 * is why the app always offers a QR code (numeric address) alongside it.
 */

let hostname: string | null = null;
let responder: ReturnType<typeof makeMdns> | null = null;

/** "Spice Garden & Café!" -> "spice-garden-cafe" (a valid single DNS label). */
export function toLocalHostname(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "saffra";
}

export function isValidLocalHostname(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(value);
}

export function getLocalHostname(): string | null {
  return hostname;
}

export function isLocalNameActive(): boolean {
  return responder !== null && hostname !== null;
}

/** Changes the announced name immediately (e.g. after the restaurant is renamed). */
export function setLocalHostname(name: string | null): void {
  const next = name && isValidLocalHostname(name) ? name : null;
  if (next !== hostname) logger.info(next ? `Announcing this computer on Wi-Fi as ${next}.local` : "Not announcing a .local name");
  hostname = next;
}

export function startLocalNameResponder(): boolean {
  if (responder) return true;
  try {
    // reuseAddr: share UDP 5353 with the OS's own mDNS service (Bonjour,
    // Windows' built-in responder, avahi) instead of fighting it for the port.
    responder = makeMdns({ reuseAddr: true });
  } catch (err) {
    logger.warn("Couldn't start the Wi-Fi name service — the numeric address still works", err);
    return false;
  }

  responder.on("error", (err) => logger.warn("Wi-Fi name service error", err));
  responder.on("query", (query, rinfo) => {
    if (!hostname || !responder) return;
    const fqdn = `${hostname}.local`;
    const asked = query.questions.some((q) => q.name.toLowerCase() === fqdn && (q.type === "A" || (q.type as string) === "ANY"));
    if (!asked) return;
    const address = lanAddressFacing(rinfo.address);
    if (!address) return;
    responder.respond({ answers: [{ name: fqdn, type: "A", ttl: 120, flush: true, data: address }] });
  });
  return true;
}

export function stopLocalNameResponder(): void {
  responder?.destroy();
  responder = null;
}

import os from "node:os";

// Adapters that exist on the computer but aren't the restaurant's Wi-Fi/LAN:
// VPNs, virtual machines, WSL/Hyper-V switches, Docker, etc. Showing one of
// those addresses to staff gives them a link that simply doesn't open.
const VIRTUAL_ADAPTER = /vethernet|virtualbox|vbox|vmware|hyper-v|wsl|docker|loopback|tailscale|zerotier|hamachi|npcap|bluetooth|utun|vpn|tap-/i;
const LIKELY_LAN_ADAPTER = /wi-?fi|wlan|wireless|ethernet|^en\d|^eth\d|^wlp|^enp/i;

interface LanInterface {
  name: string;
  address: string;
  netmask: string;
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b! >= 16 && b! <= 31);
}

function score({ name, address }: LanInterface): number {
  let s = 0;
  if (isPrivateIPv4(address)) s += 4;
  if (LIKELY_LAN_ADAPTER.test(name)) s += 2;
  if (VIRTUAL_ADAPTER.test(name)) s -= 10;
  if (address.startsWith("169.254.")) s -= 20; // no DHCP lease — not really connected
  return s;
}

function lanInterfaces(): LanInterface[] {
  const result: LanInterface[] = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) result.push({ name, address: entry.address, netmask: entry.netmask });
    }
  }
  return result.sort((x, y) => score(y) - score(x));
}

/** This computer's LAN IPv4 addresses, most-likely-to-be-the-Wi-Fi first. */
export function lanAddresses(): string[] {
  return lanInterfaces().map((i) => i.address);
}

export function primaryLanAddress(): string | null {
  return lanAddresses()[0] ?? null;
}

const toInt = (ip: string) => ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;

/**
 * The address of ours that sits on the same network as `remoteIp`, so a
 * phone on the Wi-Fi is always pointed at the Wi-Fi adapter, never at a VPN
 * or VM address it can't reach.
 */
export function lanAddressFacing(remoteIp: string): string | null {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(remoteIp)) return primaryLanAddress();
  const remote = toInt(remoteIp);
  const match = lanInterfaces().find((i) => {
    const mask = toInt(i.netmask);
    return (toInt(i.address) & mask) === (remote & mask);
  });
  return match?.address ?? primaryLanAddress();
}

import { describe, it, expect, vi } from "vitest";

vi.mock("node:os", () => ({
  default: {
    networkInterfaces: () => ({
      "vEthernet (WSL)": [{ family: "IPv4", internal: false, address: "172.27.80.1", netmask: "255.255.240.0" }],
      "Wi-Fi": [{ family: "IPv4", internal: false, address: "192.168.1.42", netmask: "255.255.255.0" }],
      "Ethernet 2": [{ family: "IPv4", internal: false, address: "169.254.10.3", netmask: "255.255.0.0" }],
      Loopback: [{ family: "IPv4", internal: true, address: "127.0.0.1", netmask: "255.0.0.0" }],
    }),
  },
}));

describe("Wi-Fi name (.local)", () => {
  it("turns any restaurant name into a valid, readable address", async () => {
    const { toLocalHostname, isValidLocalHostname } = await import("../src/lib/localName.js");
    expect(toLocalHostname("Saffra Bistro")).toBe("saffra-bistro");
    expect(toLocalHostname("Spice Garden & Café!")).toBe("spice-garden-and-cafe");
    expect(toLocalHostname("  ---  ")).toBe("saffra");
    expect(toLocalHostname("मसाला")).toBe("saffra"); // nothing ASCII to keep
    const long = toLocalHostname("The Very Long Name Of A Wonderful Family Restaurant In Chennai");
    expect(long.length).toBeLessThanOrEqual(40);
    expect(isValidLocalHostname(long)).toBe(true);
  });

  it("only accepts single DNS labels", async () => {
    const { isValidLocalHostname } = await import("../src/lib/localName.js");
    expect(isValidLocalHostname("spice-garden")).toBe(true);
    expect(isValidLocalHostname("a")).toBe(true);
    expect(isValidLocalHostname("-spice")).toBe(false);
    expect(isValidLocalHostname("spice garden")).toBe(false);
    expect(isValidLocalHostname("spice.garden")).toBe(false);
    expect(isValidLocalHostname("Spice")).toBe(false);
  });
});

describe("LAN address selection", () => {
  it("puts the real Wi-Fi first, ahead of WSL/VPN and no-DHCP adapters", async () => {
    const { lanAddresses, primaryLanAddress } = await import("../src/lib/lanAddress.js");
    expect(primaryLanAddress()).toBe("192.168.1.42");
    expect(lanAddresses()).not.toContain("127.0.0.1");
    expect(lanAddresses().at(-1)).toBe("169.254.10.3");
  });

  it("answers each device with the address on its own network", async () => {
    const { lanAddressFacing } = await import("../src/lib/lanAddress.js");
    expect(lanAddressFacing("192.168.1.77")).toBe("192.168.1.42");
    expect(lanAddressFacing("172.27.85.9")).toBe("172.27.80.1");
    expect(lanAddressFacing("10.0.0.5")).toBe("192.168.1.42"); // unknown network -> best guess
    expect(lanAddressFacing("fe80::1")).toBe("192.168.1.42");
  });
});

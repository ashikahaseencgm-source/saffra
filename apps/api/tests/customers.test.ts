import { describe, it, expect } from "vitest";
import { normalizePhone } from "../src/modules/customers/customers.service.js";

describe("normalizePhone", () => {
  it("strips spaces and dashes so equivalent numbers match", () => {
    expect(normalizePhone("98765 43210")).toBe(normalizePhone("98765-43210"));
    expect(normalizePhone("9876543210")).toBe(normalizePhone("98765 43210"));
  });

  it("keeps a leading + but strips other formatting", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });

  it("strips parentheses", () => {
    expect(normalizePhone("(987) 654-3210")).toBe("9876543210");
  });
});

import { describe, it, expect } from "vitest";
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "../src/lib/jwt.js";

describe("jwt", () => {
  const payload = { sub: "user-1", employeeId: "WTR001", role: "WAITER" as const, restaurantId: "rest-1" };

  it("signs and verifies an access token round-trip", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.role).toBe("WAITER");
  });

  it("rejects a tampered access token", () => {
    const token = signAccessToken(payload);
    // Replace the last character with something guaranteed to differ from
    // it (rather than an unrelated character), so this can never coincide
    // with the original token by chance and produce a false pass.
    const lastChar = token.at(-1);
    const replacement = lastChar === "A" ? "B" : "A";
    const tampered = token.slice(0, -1) + replacement;
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it("signs and verifies a refresh token round-trip", () => {
    const token = signRefreshToken({ sub: "user-1", jti: "jti-1" });
    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.jti).toBe("jti-1");
  });

  it("hashToken is deterministic and one-way", () => {
    const token = "some-refresh-token-value";
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});

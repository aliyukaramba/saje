import { describe, expect, it } from "vitest";
import { CLAIM_LEASE_MS, retryDelayMinutes, sameSecret } from "./dispatch-rules";

const SECRET = "a".repeat(32);

describe("sameSecret", () => {
  it("accepts the exact secret", async () => {
    expect(await sameSecret(SECRET, SECRET)).toBe(true);
  });

  it("rejects a different secret of the same length", async () => {
    expect(await sameSecret("b".repeat(32), SECRET)).toBe(false);
  });

  it("rejects a secret that only matches a prefix", async () => {
    expect(await sameSecret(SECRET.slice(0, 31), SECRET)).toBe(false);
  });

  it("rejects an empty value (missing Authorization header)", async () => {
    expect(await sameSecret("", SECRET)).toBe(false);
  });

  it("rejects a secret that only differs in its last character", async () => {
    expect(await sameSecret(SECRET.slice(0, -1) + "b", SECRET)).toBe(false);
  });
});

describe("retryDelayMinutes", () => {
  it("doubles with each attempt", () => {
    expect(retryDelayMinutes(1)).toBe(2);
    expect(retryDelayMinutes(2)).toBe(4);
    expect(retryDelayMinutes(3)).toBe(8);
  });

  it("is capped at one hour", () => {
    expect(retryDelayMinutes(6)).toBe(60);
    expect(retryDelayMinutes(50)).toBe(60);
  });

  it("is at least one minute", () => {
    expect(retryDelayMinutes(0)).toBe(1);
  });
});

describe("claim lease", () => {
  it("is five minutes", () => {
    expect(CLAIM_LEASE_MS).toBe(5 * 60_000);
  });
});

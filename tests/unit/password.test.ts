/**
 * Stage 0 unit tests — password hashing & policy (audit G2).
 */
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/auth/password";

describe("password hashing (scrypt)", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct horse battery 9");
    expect(hash).toMatch(/^scrypt:16384:8:1:/);
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery 9", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery 9");
    expect(await verifyPassword("wrong horse battery 9", hash)).toBe(false);
  });

  it("produces a unique salt per hash", async () => {
    const a = await hashPassword("same-password-123");
    const b = await hashPassword("same-password-123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password-123", a)).toBe(true);
    expect(await verifyPassword("same-password-123", b)).toBe(true);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "scrypt:1:2:3:zzz:yyy")).toBe(false);
  });
});

describe("password policy", () => {
  it("requires 10+ characters", () => {
    expect(validatePasswordStrength("short1")).toMatch(/10 characters/);
  });
  it("requires a number", () => {
    expect(validatePasswordStrength("onlylettershere")).toMatch(/number/);
  });
  it("requires a letter", () => {
    expect(validatePasswordStrength("12345678901")).toMatch(/letter/);
  });
  it("accepts a strong password", () => {
    expect(validatePasswordStrength("good-pass-2026")).toBeNull();
  });
});

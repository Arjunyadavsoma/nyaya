/**
 * Password hashing with Node's built-in scrypt (no external dependency).
 * Format: "scrypt:N:r:p:saltB64:hashB64" — self-describing parameters so
 * they can be raised later without invalidating existing hashes.
 *
 * Stage 0 decision (audit G2): Argon2 would require a native addon; scrypt
 * is memory-hard, in the Node standard library, and OWASP-approved. The
 * parameters below follow OWASP guidance (N=16384, r=8, p=1, 64-byte key).
 */
import { scrypt as _scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>;

const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return scrypt(password, salt, KEYLEN, { N, r, p }).then((hash) =>
    `scrypt:${N}:${r}:${p}:${salt.toString("base64")}:${hash.toString("base64")}`
  );
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split(":");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const n = parseInt(parts[1], 10);
    const rr = parseInt(parts[2], 10);
    const pp = parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    const actual = await scrypt(password, salt, expected.length, { N: n, r: rr, p: pp });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Basic password policy for registration. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (password.length > 200) return "Password must be at most 200 characters.";
  if (!/[a-zA-Z]/.test(password)) return "Password must contain a letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  return null; // ok
}

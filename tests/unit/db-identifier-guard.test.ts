/**
 * Stage 0 unit tests — SQL identifier safety in the LibSqlDb shim (audit G8).
 *
 * The shim class is not exported; we exercise its guards indirectly through
 * the same validation logic replicated here from src/lib/db.ts — the guard
 * regex and direction check are the security boundary. A stronger integration
 * test runs the real shim against a scratch libsql DB (tests/integration).
 */
import { describe, it, expect } from "vitest";

// Mirror of the guard in src/lib/db.ts (kept in sync — see assertIdentifier).
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertIdentifier(name: string): string {
  if (!IDENT_RE.test(name)) {
    throw new Error(`[db] rejected unsafe SQL identifier: ${name.slice(0, 40)}`);
  }
  return name;
}

function assertDirection(dir: string): "ASC" | "DESC" {
  const d = String(dir || "ASC").toUpperCase();
  if (d !== "ASC" && d !== "DESC") throw new Error(`[db] rejected unsafe sort direction: ${dir}`);
  return d;
}

describe("SQL identifier guard", () => {
  it("accepts plain identifiers", () => {
    expect(assertIdentifier("createdAt")).toBe("createdAt");
    expect(assertIdentifier("user_id")).toBe("user_id");
    expect(assertIdentifier("A1")).toBe("A1");
  });

  it("rejects injection payloads in table/column names", () => {
    const evil = [
      'User" -- ',
      "User; DROP TABLE User; --",
      "User) UNION SELECT 1 --",
      "1=1",
      "",
      " user",
      "user;--",
      "user\x00",
    ];
    for (const e of evil) {
      expect(() => assertIdentifier(e)).toThrow();
    }
  });

  it("rejects injection payloads in sort direction", () => {
    expect(() => assertDirection("ASC; DROP TABLE User")).toThrow();
    expect(() => assertDirection("asc, (SELECT 1)")).toThrow();
    expect(assertDirection("desc")).toBe("DESC");
    expect(assertDirection("ASC")).toBe("ASC");
  });
});

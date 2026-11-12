import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { newCsrfToken, CSRF_COOKIE } from "@/lib/utils/csrf";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

/**
 * GET /api/auth/csrf — issue (or rotate) the double-submit CSRF cookie.
 * Authenticated callers only; the cookie is non-httpOnly so the client
 * helper can echo it in the X-CSRF-Token header.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  }
  const token = newCsrfToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // must be JS-readable for double-submit
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

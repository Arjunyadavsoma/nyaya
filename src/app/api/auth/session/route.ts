import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { login, register, logout, getUser, AuthError } from "@/lib/auth/session";
import { rateLimit, clientFingerprint } from "@/lib/utils/rate-limit";
import { db } from "@/lib/db";
import { analytics } from "@/lib/analytics/events";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

const credentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().max(100).optional(),
});

/** Map AuthError codes to safe HTTP responses. */
function authErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    const status =
      err.code === "FORBIDDEN" ? 403 :
      err.code === "ACCOUNT_LOCKED" ? 429 :
      err.code === "EMAIL_TAKEN" ? 409 :
      401; // INVALID_CREDENTIALS / WEAK_PASSWORD
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
  }
  return null;
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function POST(req: NextRequest) {
  const fp = clientFingerprint(req);
  const rl = rateLimit(`auth-login:${fp}`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a minute." } },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "A valid email and password are required." } },
      { status: 422 }
    );
  }

  try {
    const user = await login({
      email: parsed.data.email,
      password: parsed.data.password,
      ip: fp,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    await analytics.capture({
      name: "auth.login",
      properties: { provider: "credentials" },
      actorId: user.id,
    });
    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isGuest: false },
    });
  } catch (err) {
    const mapped = authErrorResponse(err);
    if (mapped) {
      logger.warn("[auth] login failed", { code: (err as AuthError).code });
      return mapped;
    }
    logger.error("[auth] login error", { msg: (err as Error).message });
    return NextResponse.json(
      { error: { code: "AUTH_FAILED", message: "Sign-in failed. Please try again." } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/login — registration (kept on the same route file for a
 * single auth surface; semantically "create credentials").
 */
export async function PUT(req: NextRequest) {
  const fp = clientFingerprint(req);
  const rl = rateLimit(`auth-register:${fp}`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a minute." } },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "A valid email and a strong password are required." } },
      { status: 422 }
    );
  }

  try {
    const user = await register({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
      ip: fp,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    await analytics.capture({
      name: "auth.register",
      properties: { provider: "credentials" },
      actorId: user.id,
    });
    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isGuest: false },
    });
  } catch (err) {
    const mapped = authErrorResponse(err);
    if (mapped) {
      logger.warn("[auth] registration failed", { code: (err as AuthError).code });
      return mapped;
    }
    logger.error("[auth] register error", { msg: (err as Error).message });
    return NextResponse.json(
      { error: { code: "REGISTER_FAILED", message: "Registration failed. Please try again." } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/login — logout (revokes the current session).
 */
export async function DELETE() {
  await logout();
  return NextResponse.json({ ok: true });
}

/**
 * GET /api/auth/login — current session state (who am I?).
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  // Active session count for the "sign out everywhere" affordance.
  let sessionCount = 0;
  try {
    sessionCount = await db.session.count({ where: { userId: user.id, revokedAt: null } });
  } catch {
    /* ignore */
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isGuest: user.isGuest,
      authProvider: user.authProvider,
    },
    sessionCount,
  });
}

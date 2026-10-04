import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser, deleteUserData } from "@/lib/auth/session";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { Role } from "@/lib/auth/roles";

const GUEST_COOKIE = "nyaya_guest";

const profilePatchSchema = z.object({
  hasConsentedLocation: z.boolean().optional(),
  hasConsentedChatStorage: z.boolean().optional(),
});

interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  authProvider: string;
  isGuest: boolean;
}

/**
 * Get-or-create a guest user, returning both the user and the cookie
 * value to set on the response. In Next.js 16 Route Handlers, we must
 * set cookies on the NextResponse object directly (not via next/headers
 * cookies().set() which doesn't propagate to NextResponse.json()).
 */
async function getOrCreateUserForApi(req: NextRequest): Promise<{ user: SessionUser; setCookie?: string }> {
  // Read the existing cookie from the request
  const existing = req.cookies.get(GUEST_COOKIE)?.value;

  if (existing) {
    const user = await db.user.findUnique({ where: { id: existing } });
    if (user) {
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          authProvider: user.authProvider,
          isGuest: user.authProvider === "guest",
        },
      };
    }
  }

  // Create a new guest user
  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      email: null,
      name: null,
      role: "viewer",
      authProvider: "guest",
    },
  });
  await db.profile.create({
    data: { userId: id },
  });

  // Build the Set-Cookie header value
  const cookieValue = `${GUEST_COOKIE}=${id}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;

  return {
    user: {
      id,
      email: null,
      name: null,
      role: "viewer" as Role,
      authProvider: "guest",
      isGuest: true,
    },
    setCookie: cookieValue,
  };
}

/** GET /api/profile — returns the user's profile + user fields. */
export async function GET(req: NextRequest) {
  const { user, setCookie } = await getOrCreateUserForApi(req);

  // Ensure a Profile row exists (created lazily on guest signup, but be defensive)
  let profile = await db.profile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    profile = await db.profile.create({ data: { userId: user.id } });
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isGuest: user.isGuest,
      authProvider: user.authProvider,
    },
    profile: {
      preferredLanguage: profile.preferredLanguage,
      hasConsentedLocation: profile.hasConsentedLocation,
      hasConsentedChatStorage: profile.hasConsentedChatStorage,
      lastActiveAt: profile.lastActiveAt,
      updatedAt: profile.updatedAt,
    },
  });

  // Set the cookie directly on the response (the fix for the loop)
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }

  return response;
}

/** PATCH /api/profile — updates DPDP consent flags. */
export async function PATCH(req: NextRequest) {
  // For PATCH, we need the existing user — read cookie directly
  const cookieId = req.cookies.get(GUEST_COOKIE)?.value;
  if (!cookieId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: cookieId } });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const data: {
    hasConsentedLocation?: boolean;
    hasConsentedChatStorage?: boolean;
  } = {};
  if (typeof parsed.data.hasConsentedLocation === "boolean") {
    data.hasConsentedLocation = parsed.data.hasConsentedLocation;
  }
  if (typeof parsed.data.hasConsentedChatStorage === "boolean") {
    data.hasConsentedChatStorage = parsed.data.hasConsentedChatStorage;
  }

  const profile = await db.profile.upsert({
    where: { userId: dbUser.id },
    create: { userId: dbUser.id, ...data },
    update: { ...data, lastActiveAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    profile: {
      hasConsentedLocation: profile.hasConsentedLocation,
      hasConsentedChatStorage: profile.hasConsentedChatStorage,
    },
  });
}

/** DELETE /api/profile — DPDP-compliant erasure of all user data + clear session. */
export async function DELETE(req: NextRequest) {
  const cookieId = req.cookies.get(GUEST_COOKIE)?.value;
  if (!cookieId) {
    return NextResponse.json({ ok: true, message: "No active session." });
  }
  const dbUser = await db.user.findUnique({ where: { id: cookieId } });
  if (!dbUser) {
    return NextResponse.json({ ok: true, message: "No active session." });
  }
  await deleteUserData(dbUser.id);

  // Clear the cookie on the response
  const response = NextResponse.json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    `${GUEST_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
  return response;
}

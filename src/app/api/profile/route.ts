import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser, getOrCreateUser, deleteUserData } from "@/lib/auth/session";
import { z } from "zod";

const profilePatchSchema = z.object({
  hasConsentedLocation: z.boolean().optional(),
  hasConsentedChatStorage: z.boolean().optional(),
  preferredLanguage: z.enum(["en", "hi", "te"]).optional(),
});

/**
 * GET /api/profile — returns the user's profile + user fields.
 * Creates a guest session when absent (preserved existing behaviour).
 */
export async function GET() {
  const user = await getOrCreateUser();

  // Ensure a Profile row exists (created lazily on guest signup, but be defensive)
  let profile = (await db.profile.findUnique?.({ where: { userId: user.id } })) as {
    preferredLanguage: string;
    hasConsentedLocation: boolean;
    hasConsentedChatStorage: boolean;
    lastActiveAt: string | Date;
    updatedAt: string | Date;
  } | null;
  if (!profile) {
    profile = (await db.profile.create?.({ data: { userId: user.id } })) as NonNullable<typeof profile>;
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
    profile: {
      preferredLanguage: profile.preferredLanguage,
      hasConsentedLocation: profile.hasConsentedLocation,
      hasConsentedChatStorage: profile.hasConsentedChatStorage,
      lastActiveAt: profile.lastActiveAt,
      updatedAt: profile.updatedAt,
    },
  });
}

/** PATCH /api/profile — updates DPDP consent flags + language preference. */
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "No session" } }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid profile fields." } },
      { status: 422 }
    );
  }

  const data: Record<string, unknown> = {};
  if (typeof parsed.data.hasConsentedLocation === "boolean") {
    data.hasConsentedLocation = parsed.data.hasConsentedLocation;
  }
  if (typeof parsed.data.hasConsentedChatStorage === "boolean") {
    data.hasConsentedChatStorage = parsed.data.hasConsentedChatStorage;
  }
  if (parsed.data.preferredLanguage) {
    data.preferredLanguage = parsed.data.preferredLanguage;
  }

  const profile = (await db.profile.upsert?.({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: { ...data, lastActiveAt: new Date() },
  })) as {
    hasConsentedLocation: boolean;
    hasConsentedChatStorage: boolean;
    preferredLanguage: string;
  };

  return NextResponse.json({
    ok: true,
    profile: {
      hasConsentedLocation: profile.hasConsentedLocation,
      hasConsentedChatStorage: profile.hasConsentedChatStorage,
      preferredLanguage: profile.preferredLanguage,
    },
  });
}

/** DELETE /api/profile — DPDP-compliant erasure of all user data + revoke session. */
export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: true, message: "No active session." });
  }
  await deleteUserData(user.id);
  return NextResponse.json({ ok: true });
}

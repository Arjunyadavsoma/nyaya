import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import type { Role } from "./roles";

const SESSION_COOKIE = "nyaya_session";
const GUEST_COOKIE = "nyaya_guest";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  authProvider: string;
  isGuest: boolean;
}

/**
 * Get or create a guest user. Guests are persisted in the User table with
 * authProvider="guest" and a stable cookie so their bookmarks/chat history
 * survive across sessions on the same device.
 */
export async function getOrCreateUser(): Promise<SessionUser> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE)?.value;

  if (existing) {
    const user = await db.user.findUnique({ where: { id: existing } });
    if (user) {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
        authProvider: user.authProvider,
        isGuest: user.authProvider === "guest",
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
  cookieStore.set(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
  return {
    id,
    email: null,
    name: null,
    role: "viewer",
    authProvider: "guest",
    isGuest: true,
  };
}

export async function getUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(GUEST_COOKIE)?.value;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    authProvider: user.authProvider,
    isGuest: user.authProvider === "guest",
  };
}

export async function requireRole(required: Role): Promise<SessionUser> {
  const user = await getOrCreateUser();
  const rank = { viewer: 0, editor: 1, legal_reviewer: 2, superadmin: 3 } as const;
  if (rank[user.role] < rank[required]) {
    throw new Error(`Forbidden: requires ${required} role`);
  }
  return user;
}

/** Delete all user data (DPDP Act compliance). */
export async function deleteUserData(userId: string): Promise<void> {
  await db.bookmark.deleteMany({ where: { userId } });
  await db.feedback.deleteMany({ where: { userId } });
  await db.chatSession.deleteMany({ where: { userId } });
  await db.contentReport.deleteMany({ where: { userId } });
  await db.profile.deleteMany({ where: { userId } });
  await db.user.delete({ where: { id: userId } });
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_COOKIE);
}

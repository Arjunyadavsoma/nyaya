/**
 * Session management (Stage 0 security rewrite — audit G1/G2/G3).
 *
 * Model:
 *  - Every visitor gets a GUEST user (preserved existing behaviour) with a
 *    DB-backed Session row.
 *  - Registered users authenticate with email+password (scrypt) and get a
 *    Session row; the cookie holds only an opaque 256-bit token, the DB
 *    stores its SHA-256 hash.
 *  - Sessions have absolute expiry (30 days), a sliding inactivity window,
 *    are rotated on login/registration (session-fixation defence), and can
 *    be revoked individually or per-user.
 *  - Login attempts are counted per account and lock it after 10 failures
 *    for 15 minutes.
 *
 * The libsql production client gets a `session` accessor with the same
 * semantics (see src/lib/db.ts).
 */
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import type { Role } from "./roles";

const SESSION_COOKIE = "nyaya_session";
/** Absolute session lifetime: 30 days. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Sliding inactivity window: sessions untouched for 7 days are expired on read. */
const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
/** Login lockout: 10 failures → 15-minute lock. */
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  authProvider: string;
  isGuest: boolean;
}

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

interface SessionRow {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: string | Date;
  lastSeenAt: string | Date;
  revokedAt: string | Date | null;
}

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  authProvider: string;
  passwordHash: string | null;
  failedLogins: number;
  lockedUntil: string | Date | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isExpired(s: SessionRow): boolean {
  const now = Date.now();
  if (s.revokedAt) return true;
  if (now > new Date(s.expiresAt).getTime()) return true;
  if (now - new Date(s.lastSeenAt).getTime() > SESSION_IDLE_MS) return true;
  return false;
}

function toSessionUser(u: UserRow): SessionUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    authProvider: u.authProvider,
    isGuest: u.authProvider === "guest",
  };
}

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  };
}

/** Create a session row and return the raw token (caller sets the cookie). */
async function createSession(userId: string, meta?: { ip?: string; userAgent?: string; rotatedFrom?: string }): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.session.create?.({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      lastSeenAt: now,
      createdAt: now,
      rotatedFrom: meta?.rotatedFrom ?? null,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 200) ?? null,
    },
  });
  return token;
}

/** Resolve the current session cookie → user (or null). Never creates. */
export async function getUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = (await db.session.findUnique?.({ where: { tokenHash: hashToken(token) } })) as SessionRow | null;
  if (!session || isExpired(session)) return null;

  const user = (await db.user.findUnique?.({ where: { id: session.userId } })) as UserRow | null;
  if (!user) return null;

  // Touch lastSeen (sliding window). Best-effort — failures must not break reads.
  try {
    await db.session.update?.({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  } catch {
    /* ignore */
  }
  return toSessionUser(user);
}

/** Get the current user, or create a guest user+session when absent. */
export async function getOrCreateUser(): Promise<SessionUser> {
  const existing = await getUser();
  if (existing) return existing;

  const id = "g" + randomBytes(12).toString("hex");
  await db.user.create?.({
    data: { id, email: null, name: null, role: "viewer", authProvider: "guest" },
  });
  await db.profile.create?.({ data: { userId: id } });
  const token = await createSession(id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOpts());
  return { id, email: null, name: null, role: "viewer", authProvider: "guest", isGuest: true };
}

/** Verify credentials and rotate the current session onto the user.
 *  Guest-owned data is merged into the account before the guest is removed.
 */
export async function login(opts: {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}): Promise<SessionUser> {
  const emailNorm = opts.email.trim().toLowerCase();
  const user = (await db.user.findUnique?.({ where: { email: emailNorm } })) as UserRow | null;

  // Uniform failure — never reveal whether the email exists.
  const invalid = new AuthError("INVALID_CREDENTIALS", "Incorrect email or password.");
  if (!user || !user.passwordHash) throw invalid;

  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    throw new AuthError("ACCOUNT_LOCKED", "Too many failed attempts. Try again in a few minutes.");
  }

  const { verifyPassword } = await import("./password");
  const ok = await verifyPassword(opts.password, user.passwordHash);
  if (!ok) {
    const failed = (user.failedLogins ?? 0) + 1;
    await db.user.update?.({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    throw invalid;
  }

  // Success: reset counters, migrate guest data, rotate session.
  await db.user.update?.({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

  const cookieStore = await cookies();
  const oldToken = cookieStore.get(SESSION_COOKIE)?.value;
  let oldSessionId: string | undefined;
  if (oldToken) {
    const oldSession = (await db.session.findUnique?.({ where: { tokenHash: hashToken(oldToken) } })) as SessionRow | null;
    if (oldSession) {
      oldSessionId = oldSession.id;
      if (oldSession.userId !== user.id) await migrateGuestData(oldSession.userId, user.id);
    }
  }

  const token = await createSession(user.id, { ip: opts.ip, userAgent: opts.userAgent, rotatedFrom: oldSessionId });
  cookieStore.set(SESSION_COOKIE, token, cookieOpts());
  return toSessionUser(user);
}

/** Register a new credentials user and log them in (rotating any guest session). */
export async function register(opts: {
  email: string;
  password: string;
  name?: string;
  ip?: string;
  userAgent?: string;
}): Promise<SessionUser> {
  const emailNorm = opts.email.trim().toLowerCase();
  const existing = await db.user.findUnique?.({ where: { email: emailNorm } });
  if (existing) throw new AuthError("EMAIL_TAKEN", "An account with this email already exists.");

  const { hashPassword, validatePasswordStrength } = await import("./password");
  const strengthError = validatePasswordStrength(opts.password);
  if (strengthError) throw new AuthError("WEAK_PASSWORD", strengthError);

  const passwordHash = await hashPassword(opts.password);
  const id = "u" + randomBytes(12).toString("hex");
  await db.user.create?.({
    data: {
      id,
      email: emailNorm,
      name: opts.name?.trim() || null,
      role: "viewer",
      authProvider: "credentials",
      passwordHash,
    },
  });
  await db.profile.create?.({ data: { userId: id } });

  // Carry over any guest data from the current session.
  const cookieStore = await cookies();
  const oldToken = cookieStore.get(SESSION_COOKIE)?.value;
  let rotatedFrom: string | undefined;
  if (oldToken) {
    const oldSession = (await db.session.findUnique?.({ where: { tokenHash: hashToken(oldToken) } })) as SessionRow | null;
    if (oldSession) {
      rotatedFrom = oldSession.id;
      if (oldSession.userId !== id) await migrateGuestData(oldSession.userId, id);
    }
  }

  const token = await createSession(id, { ip: opts.ip, userAgent: opts.userAgent, rotatedFrom });
  cookieStore.set(SESSION_COOKIE, token, cookieOpts());
  return { id, email: emailNorm, name: opts.name ?? null, role: "viewer", authProvider: "credentials", isGuest: false };
}

/** Revoke the current session (logout). Always clears the cookie. */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await db.session.update?.({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } });
    } catch {
      /* ignore */
    }
  }
  cookieStore.set(SESSION_COOKIE, "", { ...cookieOpts(), maxAge: 0 });
}

/** Revoke every session of a user (role change, compromise). */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session.updateMany?.({ where: { userId }, data: { revokedAt: new Date() } });
}

/** Move guest-owned rows to the real account, then delete the guest shell. */
async function migrateGuestData(guestId: string, userId: string): Promise<void> {
  try {
    await db.chatSession.updateMany?.({ where: { userId: guestId }, data: { userId } });
    await db.bookmark.updateMany?.({ where: { userId: guestId }, data: { userId } });
    await db.feedback.updateMany?.({ where: { userId: guestId }, data: { userId } });
    await db.contentReport.updateMany?.({ where: { userId: guestId }, data: { userId } });
    await db.session.updateMany?.({ where: { userId: guestId }, data: { revokedAt: new Date() } });
    await db.profile.deleteMany?.({ where: { userId: guestId } });
    await db.user.delete?.({ where: { id: guestId } });
  } catch {
    // Migration is best-effort: a failure must not block login.
  }
}

export async function requireRole(required: Role): Promise<SessionUser> {
  const user = await getOrCreateUser();
  const rank = { viewer: 0, editor: 1, legal_reviewer: 2, superadmin: 3 } as const;
  if (rank[user.role] < rank[required]) {
    throw new AuthError("FORBIDDEN", `Forbidden: requires ${required} role`);
  }
  return user;
}

/** Delete all user data (DPDP Act compliance) and revoke sessions.
 *  Stage 7: extended to matters, drafts, research reports, and documents
 *  (DB rows; document FILES are removed by the profile deletion handler
 *  via the storage-key list fetched before row deletion). */
export async function deleteUserData(userId: string): Promise<void> {
  // Collect document storage keys BEFORE deleting rows so files can be purged.
  let storageKeys: string[] = [];
  try {
    const docs = await db.userDocument?.findMany?.({ where: { userId }, take: 500 });
    storageKeys = (docs ?? []).map((d: { storageKey: string }) => d.storageKey);
  } catch { /* best-effort */ }

  await db.session.updateMany?.({ where: { userId }, data: { revokedAt: new Date() } });
  await db.bookmark.deleteMany?.({ where: { userId } });
  await db.feedback.deleteMany?.({ where: { userId } });
  await db.chatSession.deleteMany?.({ where: { userId } });
  await db.contentReport.deleteMany?.({ where: { userId } });
  await db.researchReport?.deleteMany?.({ where: { userId } });
  await db.userDraft?.deleteMany?.({ where: { userId } });
  await db.userDocument?.deleteMany?.({ where: { userId } });
  await db.matter?.deleteMany?.({ where: { userId } }); // events/tasks cascade
  await db.profile.deleteMany?.({ where: { userId } });
  await db.user.delete?.({ where: { id: userId } });

  // Purge stored document files (best-effort; DB rows already gone).
  try {
    const { deleteDocumentFile } = await import("@/lib/documents/processing");
    await Promise.all(storageKeys.map((k) => deleteDocumentFile(k).catch(() => {})));
  } catch { /* module unavailable in some contexts */ }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...cookieOpts(), maxAge: 0 });
}

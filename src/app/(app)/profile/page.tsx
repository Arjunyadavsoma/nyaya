import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { ConsentToggles } from "@/components/profile/consent-toggles";
import { BookmarksList } from "@/components/profile/bookmarks-list";
import { DataDeletionCard } from "@/components/profile/data-deletion-card";
import { InitSession } from "@/components/profile/init-session";
import { RecentlyViewedList } from "@/components/profile/recently-viewed-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, ShieldCheck, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(iso: string | Date | null): string {
  if (!iso) return "—";
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function getInitials(name: string | null, email: string | null): string {
  const src = (name || email || "Guest").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "G";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Note: we use getUser() (not getOrCreateUser()) because Next.js 16 forbids
// `cookies().set()` inside Server Components. If no session exists yet, we
// render <InitSession /> which lazily calls /api/profile (a Route Handler
// that *can* set cookies) and reloads the page.
export default async function ProfilePage() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-7 w-7 text-primary" />
            Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, consent preferences, and saved bookmarks.
          </p>
        </header>
        <InitSession />
        <DisclaimerBanner />
      </div>
    );
  }

  // Ensure profile exists (it is created on guest signup, but be defensive)
  let profile = await db.profile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    profile = await db.profile.create({ data: { userId: user.id } });
  }

  const bookmarks = await db.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const displayName = user.name ?? (user.isGuest ? "Guest" : "Member");
  const initials = getInitials(user.name, user.email);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-7 w-7 text-primary" />
          Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, consent preferences, and saved bookmarks. Your
          data stays on this device unless you sign in.
        </p>
      </header>

      {/* User info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-base truncate">{displayName}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <span className="truncate">
                  {user.email ?? "No email — guest session"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <ShieldCheck className="h-3 w-3" />
              {ROLE_LABELS[user.role as Role] ?? user.role}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {user.isGuest ? "Guest session" : user.authProvider}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <CalendarClock className="h-3 w-3" />
              Active since {formatDate(profile.lastActiveAt)}
            </Badge>
          </div>

          {user.isGuest && (
            <p className="text-xs text-muted-foreground italic leading-snug">
              You&apos;re using Nyaya as a guest. Bookmarks and chat history are
              saved on this device only. Sign in later to sync across devices
              (coming soon).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Consent toggles */}
      <ConsentToggles
        initialLocation={profile.hasConsentedLocation}
        initialChatStorage={profile.hasConsentedChatStorage}
      />

      {/* Bookmarks list */}
      <BookmarksList
        initial={bookmarks.map((b) => ({
          id: b.id,
          type: b.type,
          refId: b.refId,
          label: b.label,
          createdAt: b.createdAt.toISOString(),
        }))}
      />

      {/* Recently viewed */}
      <RecentlyViewedList />

      {/* Data deletion */}
      <DataDeletionCard />

      <DisclaimerBanner />
    </div>
  );
}

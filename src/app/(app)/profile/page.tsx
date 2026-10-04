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
import { User, Mail, ShieldCheck, CalendarClock, Scale } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const revalidate = 0;

function formatDate(iso: string | Date | null): string {
  if (!iso) return "—";
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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

export default async function ProfilePage() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-7 w-7 text-primary" /> Profile
          </h1>
        </header>
        <InitSession />
        <DisclaimerBanner />
      </div>
    );
  }

  let profile = await db.profile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    profile = await db.profile.create({ data: { userId: user.id } });
  }

  const bookmarks = await db.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  }) as Array<{ id: string; type: string; refId: string; label: string; createdAt: string | Date }>;

  const displayName = user.name ?? (user.isGuest ? "Guest" : "Member");
  const initials = getInitials(user.name, user.email);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-7 w-7 text-primary" /> Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, consent preferences, and saved bookmarks.
        </p>
      </header>

      {/* Account card */}
      <Card className="overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-primary to-primary/70" />
        <CardContent className="-mt-8 pb-4">
          <div className="flex items-end gap-4">
            <Avatar className="h-16 w-16 border-4 border-background rounded-full bg-primary/10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-2">
              <div className="font-semibold text-lg truncate">{displayName}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="truncate">{user.email ?? "No email — guest session"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge variant="secondary" className="text-xs">
              <ShieldCheck className="h-3 w-3" />
              {ROLE_LABELS[user.role as Role] ?? user.role}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {user.isGuest ? "Guest session" : user.authProvider}
            </Badge>
            {profile?.lastActiveAt && (
              <Badge variant="outline" className="text-xs">
                <CalendarClock className="h-3 w-3" />
                Active since {formatDate(profile.lastActiveAt as string | Date)}
              </Badge>
            )}
          </div>
          {user.isGuest && (
            <p className="text-xs text-muted-foreground italic leading-snug mt-2">
              You&apos;re using Nyaya as a guest. Bookmarks and chat history are saved on this device only.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Consent toggles */}
      <ConsentToggles
        initialLocation={profile?.hasConsentedLocation ?? false}
        initialChatStorage={profile?.hasConsentedChatStorage ?? false}
      />

      {/* Bookmarks */}
      <BookmarksList
        initial={bookmarks.map((b) => ({
          id: b.id,
          type: b.type,
          refId: b.refId,
          label: b.label,
          createdAt: typeof b.createdAt === "string" ? b.createdAt : b.createdAt.toISOString(),
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

export function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <Skeleton className="h-8 w-40 rounded" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, MessageSquare, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ConsentTogglesProps {
  initialLocation: boolean;
  initialChatStorage: boolean;
}

/**
 * Two consent switches bound to PATCH /api/profile. Shows a warning when
 * location consent is off — Nearby Police needs it to function.
 */
export function ConsentToggles({
  initialLocation,
  initialChatStorage,
}: ConsentTogglesProps) {
  const [location, setLocation] = useState(initialLocation);
  const [chatStorage, setChatStorage] = useState(initialChatStorage);
  const [isPending, startTransition] = useTransition();

  function patch(payload: {
    hasConsentedLocation?: boolean;
    hasConsentedChatStorage?: boolean;
  }) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(
            j?.error?.[0]?.message ?? "Failed to update consent"
          );
        }
        const data = await res.json();
        if (typeof data.profile?.hasConsentedLocation === "boolean") {
          setLocation(data.profile.hasConsentedLocation);
        }
        if (typeof data.profile?.hasConsentedChatStorage === "boolean") {
          setChatStorage(data.profile.hasConsentedChatStorage);
        }
        toast.success("Consent preference saved");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update consent"
        );
        // Revert optimistic state on error
        setLocation(initialLocation);
        setChatStorage(initialChatStorage);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consent &amp; Data Preferences</CardTitle>
        <CardDescription>
          You decide what data Nyaya can store about you, per the Digital
          Personal Data Protection (DPDP) Act, 2023.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <Label
                  htmlFor="consent-location"
                  className="text-sm font-medium cursor-pointer"
                >
                  Location access for Nearby Police
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Required to find police stations and legal-aid offices near
                  you. We never track continuous location — only when you ask.
                </p>
              </div>
            </div>
            <Switch
              id="consent-location"
              checked={location}
              onCheckedChange={(v) => {
                setLocation(v); // optimistic
                patch({ hasConsentedLocation: v });
              }}
              disabled={isPending}
              aria-label="Toggle location consent"
            />
          </div>
          {!location && (
            <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/30 px-2.5 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <p className="text-[11px] leading-snug text-warning-foreground">
                <strong>Nearby Police is limited</strong> without location
                consent. You can still browse stations by city, but live distance
                won&apos;t work.
              </p>
            </div>
          )}
        </div>

        {/* Chat storage */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 h-8 w-8 rounded-full bg-accent/15 text-accent-foreground flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <Label
                  htmlFor="consent-chat"
                  className="text-sm font-medium cursor-pointer"
                >
                  Save my chat history
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Lets you resume past conversations and bookmark answers. Turn
                  off to keep chats in memory only.
                </p>
              </div>
            </div>
            <Switch
              id="consent-chat"
              checked={chatStorage}
              onCheckedChange={(v) => {
                setChatStorage(v);
                patch({ hasConsentedChatStorage: v });
              }}
              disabled={isPending}
              aria-label="Toggle chat-storage consent"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge variant="outline" className="text-[10px]">
            DPDP Act, 2023
          </Badge>
          {isPending && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

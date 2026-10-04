"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FeedbackRow {
  id: string;
  rating: number | null;
  comment: string | null;
  messageId: string | null;
  createdAt: string;
  user: { name: string | null; email: string | null } | null;
}

export function FeedbackReview() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch("/api/ai/feedback");
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const positive = feedback.filter((f) => f.rating != null && f.rating >= 4).length;
  const negative = feedback.filter((f) => f.rating != null && f.rating < 4).length;
  const withComments = feedback.filter((f) => f.comment).length;

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Chat feedback
          {feedback.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({feedback.length})</span>
          )}
        </CardTitle>
        <button
          onClick={refresh}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          Refresh
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-success/30 bg-success/5 p-2 text-center">
            <ThumbsUp className="h-4 w-4 text-success mx-auto mb-1" />
            <div className="text-lg font-bold text-success">{positive}</div>
            <div className="text-[10px] text-muted-foreground">Helpful</div>
          </div>
          <div className="rounded-lg border border-emergency/30 bg-emergency/5 p-2 text-center">
            <ThumbsDown className="h-4 w-4 text-emergency mx-auto mb-1" />
            <div className="text-lg font-bold text-emergency">{negative}</div>
            <div className="text-[10px] text-muted-foreground">Not helpful</div>
          </div>
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-2 text-center">
            <Star className="h-4 w-4 text-accent-foreground mx-auto mb-1" />
            <div className="text-lg font-bold text-accent-foreground">{withComments}</div>
            <div className="text-[10px] text-muted-foreground">With notes</div>
          </div>
        </div>

        {/* Feedback list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : feedback.length === 0 ? (
          <div className="text-center py-4">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground mt-2">
              No feedback submitted yet. Feedback from chat messages will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto nyaya-scroll">
            {feedback.map((f) => (
              <li
                key={f.id}
                className={cn(
                  "rounded-md border p-2.5",
                  f.rating != null && f.rating >= 4
                    ? "border-success/20 bg-success/5"
                    : f.rating != null
                    ? "border-emergency/20 bg-emergency/5"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    {f.rating != null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          f.rating >= 4
                            ? "border-success/40 text-success"
                            : "border-emergency/40 text-emergency"
                        )}
                      >
                        {f.rating >= 4 ? (
                          <ThumbsUp className="h-2.5 w-2.5 mr-1" />
                        ) : (
                          <ThumbsDown className="h-2.5 w-2.5 mr-1" />
                        )}
                        {f.rating}/5
                      </Badge>
                    )}
                    {f.user?.name || f.user?.email ? (
                      <span className="text-[10px] text-muted-foreground">
                        {f.user.name ?? f.user.email}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Anonymous</span>
                    )}
                  </div>
                  <time className="text-[10px] text-muted-foreground">
                    {new Date(f.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                {f.comment && (
                  <p className="text-xs text-foreground leading-relaxed mt-1">
                    &ldquo;{f.comment}&rdquo;
                  </p>
                )}
                {f.messageId && (
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                    msg: {f.messageId.slice(-8)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Flag, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShareButton } from "@/components/common/share-button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MessageActionsProps {
  messageId?: string;
  content: string;
  citations?: Array<{ actName: string; sectionNo?: string; sourceUrl?: string; verified: boolean }>;
  bookmarkButton?: React.ReactNode;
}

export function MessageActions({ messageId, content, citations, bookmarkButton }: MessageActionsProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [copied, setCopied] = useState(false);

  const submitFeedback = async (rating: "up" | "down") => {
    setFeedback(rating);
    if (!messageId) return;
    try {
      await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          rating: rating === "up" ? 5 : 2,
        }),
      });
      toast.success(rating === "up" ? "Glad it helped!" : "Thanks — we'll review this.");
    } catch {
      toast.error("Could not submit feedback");
    }
  };

  const submitReport = async () => {
    if (!reportReason.trim()) {
      toast.error("Please describe the issue");
      return;
    }
    try {
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "rights-article",
          refId: messageId ?? "chat-message",
          reason: reportReason.trim(),
        }),
      });
      toast.success("Report submitted. Our team will review it.");
      setReportOpen(false);
      setReportReason("");
    } catch {
      toast.error("Could not submit report");
    }
  };

  const copyContent = async () => {
    try {
      // Build a markdown version with citations + attribution
      let markdown = content.trim();
      if (citations && citations.length > 0) {
        const verified = citations.filter((c) => c.verified);
        if (verified.length > 0) {
          markdown += "\n\n---\n\n**Sources:**\n";
          for (const c of verified) {
            const link = c.sourceUrl ? `[${c.actName}${c.sectionNo ? ` §${c.sectionNo}` : ""}](${c.sourceUrl})` : `${c.actName}${c.sectionNo ? ` §${c.sectionNo}` : ""}`;
            markdown += `- ${link}\n`;
          }
        }
      }
      markdown += "\n---\n*Via [Nyaya](/) — legal information for India. Not legal advice.*\n";
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied as Markdown");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-0.5 flex-wrap">
      {bookmarkButton}
      <button
        onClick={() => submitFeedback("up")}
        className={cn(
          "tap-target inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-xs",
          feedback === "up" ? "text-success" : "text-muted-foreground"
        )}
        aria-label="Helpful"
        aria-pressed={feedback === "up"}
      >
        <ThumbsUp className="h-3.5 w-3.5" fill={feedback === "up" ? "currentColor" : "none"} />
      </button>
      <button
        onClick={() => submitFeedback("down")}
        className={cn(
          "tap-target inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-xs",
          feedback === "down" ? "text-emergency" : "text-muted-foreground"
        )}
        aria-label="Not helpful"
        aria-pressed={feedback === "down"}
      >
        <ThumbsDown className="h-3.5 w-3.5" fill={feedback === "down" ? "currentColor" : "none"} />
      </button>
      <button
        onClick={copyContent}
        className="tap-target inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
        aria-label="Copy answer"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => setReportOpen(true)}
        className="tap-target inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
        aria-label="Report an issue"
      >
        <Flag className="h-3.5 w-3.5" />
      </button>
      <ShareButton title="This Nyaya answer" />

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-emergency" /> Report an issue with this answer
            </DialogTitle>
            <DialogDescription>
              Help us improve Nyaya. Tell us what's wrong — for example: incorrect citation, outdated law, offensive content, or factual error.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue…"
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{reportReason.length}/2000</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button variant="destructive" onClick={submitReport}>
              <Flag className="h-4 w-4 mr-1" /> Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Share2, Copy, Check, MessageCircle, Twitter, Facebook, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareButtonProps {
  title: string;
  href?: string;
  variant?: "icon" | "pill";
  className?: string;
}

export function ShareButton({ title, href, variant = "icon", className }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullUrl = href
    ? (typeof window !== "undefined" ? `${window.location.origin}${href}` : href)
    : (typeof window !== "undefined" ? window.location.href : "");

  const shareText = `${title} — via Nyaya (legal information for India)`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedText = encodeURIComponent(shareText);

  const shareLinks = [
    { label: "WhatsApp", icon: MessageCircle, url: `https://wa.me/?text=${encodedText}%20${encodedUrl}`, color: "text-success" },
    { label: "Twitter / X", icon: Twitter, url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, color: "text-foreground" },
    { label: "Facebook", icon: Facebook, url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, color: "text-chart-5" },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: fullUrl });
        setOpen(false);
      } catch {
        // user cancelled
      }
    } else {
      copyLink();
    }
  };

  if (variant === "pill") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (navigator.share ? nativeShare() : setOpen(true))}
          className={className}
        >
          <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
        </Button>
        <ShareDialog
          open={open}
          onOpenChange={setOpen}
          title={title}
          fullUrl={fullUrl}
          shareLinks={shareLinks}
          copied={copied}
          onCopy={copyLink}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => (navigator.share ? nativeShare() : setOpen(true))}
        className="tap-target inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
        aria-label="Share"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        fullUrl={fullUrl}
        shareLinks={shareLinks}
        copied={copied}
        onCopy={copyLink}
      />
    </>
  );
}

function ShareDialog({
  open,
  onOpenChange,
  title,
  fullUrl,
  shareLinks,
  copied,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  fullUrl: string;
  shareLinks: { label: string; icon: typeof Share2; url: string; color: string }[];
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" /> Share this
          </DialogTitle>
          <DialogDescription>
            Share &ldquo;{title}&rdquo; with others who may find it useful.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Social buttons */}
          <div className="grid grid-cols-3 gap-2">
            {shareLinks.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-3 hover:bg-accent/10 transition-colors"
                >
                  <Icon className={`h-5 w-5 ${s.color}`} />
                  <span className="text-xs font-medium">{s.label}</span>
                </a>
              );
            })}
          </div>

          {/* Copy link */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
            <input
              type="text"
              readOnly
              value={fullUrl}
              className="flex-1 bg-transparent text-xs px-2 py-1 outline-none truncate"
              aria-label="Shareable link"
            />
            <Button size="sm" variant="ghost" onClick={onCopy} className="shrink-0">
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>

          {/* Native share (if supported) */}
          {typeof navigator !== "undefined" && navigator.share && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.share({ title, url: fullUrl }).catch(() => {});
                onOpenChange(false);
              }}
            >
              <Share2 className="h-4 w-4 mr-2" /> Use device share
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

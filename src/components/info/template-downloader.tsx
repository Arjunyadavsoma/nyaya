"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, Check, FileText } from "lucide-react";
import { toast } from "sonner";

export interface DocumentTemplateInfo {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  body: string;
  format?: string | null;
  category: string;
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function TemplateDownloader({ template }: { template: DocumentTemplateInfo }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(template.body);
      setCopied(true);
      toast.success("Template copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for older browsers / insecure context
      try {
        const ta = document.createElement("textarea");
        ta.value = template.body;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        toast.success("Template copied to clipboard");
        setTimeout(() => setCopied(false), 1800);
      } catch {
        toast.error("Copy failed. Please select and copy manually.");
      }
    }
  }

  function handleDownload() {
    try {
      const blob = new Blob([template.body], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeFilename(template.slug || template.title)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Download failed. Try copying instead.");
    }
  }

  return (
    <Card className="bg-card flex flex-col h-full py-0">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-snug flex items-start gap-2">
            <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>{template.title}</span>
          </CardTitle>
          <Badge variant="outline" className="text-[10px] shrink-0 uppercase">
            {template.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-1 flex flex-col gap-3">
        {template.description && (
          <CardDescription className="text-xs leading-relaxed">
            {template.description}
          </CardDescription>
        )}
        <div className="flex items-center gap-2 mt-auto">
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className="h-8 text-xs flex-1"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy template
              </>
            )}
          </Button>
          <Button
            onClick={handleDownload}
            variant="default"
            size="sm"
            className="h-8 text-xs flex-1"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground italic leading-snug">
          This is a general template, not legal advice. Have a qualified advocate
          review before filing.
        </p>
      </CardContent>
    </Card>
  );
}

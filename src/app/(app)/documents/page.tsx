import { FileText } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/common/page-primitives";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Documents — Nyaya",
  description: "Upload legal documents and get secure AI-assisted analysis.",
};

/**
 * Document workspace (Stage 4 module): upload → extraction (PDF/DOCX/TXT/OCR)
 * → analysis (parties, dates, clauses, risks) → grounded Q&A. Ships in
 * Stage 4; private-by-default storage and per-download authorization are
 * part of that stage's security requirements.
 */
export default function DocumentsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <PageHeader
        icon={FileText}
        title="Document intelligence"
        description="Upload a rental agreement, notice, or court order — get a summary, key clauses, dates, parties, and risks, with page-level citations."
      />
      <EmptyState
        icon={FileText}
        title="Document analysis coming in Stage 4"
        description="Secure upload with OCR, clause extraction, deadline detection, and question answering grounded strictly in your document. Extracted text will always be shown separately from AI interpretation."
        action={
          <Button asChild>
            <Link href="/chat">Ask about your situation meanwhile</Link>
          </Button>
        }
      />
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Planned capabilities:</span>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Formats</Badge> PDF, DOCX, TXT, images with OCR (Hindi + English)</li>
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Security</Badge> Magic-byte validation, private storage, per-download authorization</li>
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Analysis</Badge> Parties, obligations, deadlines, clause flags with reasoning</li>
              <li className="flex items-start gap-2"><Badge variant="outline" className="text-[10px] mt-0.5">Q&A</Badge> Answers grounded in your document with page references</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { Scale, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 py-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <Scale className="h-4 w-4 text-primary" /> Nyaya
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Free legal information for every Indian. Plain language, cited sources,
            offline-ready. Built as a Progressive Web App.
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Legal</div>
          <Link href="/about" className="block hover:text-primary transition-colors">About</Link>
          <Link href="/privacy" className="block hover:text-primary transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="block hover:text-primary transition-colors">Terms of Use</Link>
          <Link href="/disclaimer" className="block hover:text-primary transition-colors">Disclaimer</Link>
        </div>
        <div className="space-y-1.5">
          <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Emergency</div>
          <a href="tel:112" className="block hover:text-emergency transition-colors">112 — National Emergency</a>
          <a href="tel:100" className="block hover:text-emergency transition-colors">100 — Police</a>
          <a href="tel:1091" className="block hover:text-emergency transition-colors">1091 — Women Helpline</a>
          <a href="tel:1098" className="block hover:text-emergency transition-colors">1098 — Child Helpline</a>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs rounded-md bg-emergency/5 border border-emergency/20 p-2.5">
            <ShieldCheck className="h-4 w-4 text-emergency shrink-0 mt-0.5" />
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Legal information, not legal advice.</strong> Nyaya never replaces
              a licensed advocate, police, or emergency services.
            </p>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Nyaya. Free for all Indians. Sources cited on every answer.
      </div>
    </footer>
  );
}

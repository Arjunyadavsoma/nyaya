"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, Moon, Sun, Menu, LogIn } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { NAV_SECTIONS } from "./nav-config";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { SearchPalette } from "@/components/common/search-palette";
import { LanguageSwitcher } from "@/components/common/language-switcher";

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <Link href="/" className="flex items-center gap-2" aria-label="Nyaya home">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
          <Scale className="h-4 w-4" />
        </div>
        <span className="font-bold text-base">Nyaya</span>
      </Link>
      <div className="flex items-center gap-1">
        <SearchPalette />
        <LanguageSwitcher compact />
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="tap-target inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Toggle dark mode"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="tap-target inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 overflow-y-auto nyaya-scroll">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" /> Nyaya
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-2" aria-label="Mobile navigation">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="mb-4">
                  <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {section.label}
                  </div>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = isActive(item.href);
                      const Icon = item.icon;
                      return (
                        <li key={item.key}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium",
                              item.tone === "emergency" && !active && "text-emergency",
                              active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                            )}
                          >
                            <Icon className={cn("h-4 w-4", item.tone === "emergency" && "text-emergency")} />
                            <span className="flex-1">{item.label}</span>
                            {item.description && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-24">
                                {item.description}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="mt-2 pt-4 border-t border-border">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium hover:bg-accent/50"
              >
                <LogIn className="h-4 w-4" />
                Sign in / create account
              </Link>
              <p className="px-3 mt-2 text-[11px] leading-snug text-muted-foreground">
                Optional — keeps bookmarks and chat history across devices.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

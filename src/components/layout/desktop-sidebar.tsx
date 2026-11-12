"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "./nav-config";
import { cn } from "@/lib/utils";
import { Scale, Moon, Sun, LogIn } from "lucide-react";
import { useTheme } from "next-themes";
import { SearchPalette } from "@/components/common/search-palette";
import { KeyboardShortcuts } from "@/components/common/keyboard-shortcuts";
import { LanguageSwitcher } from "@/components/common/language-switcher";

export function DesktopSidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary text-primary-foreground">
          <Scale className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-bold text-lg text-sidebar-foreground">Nyaya</div>
          <div className="text-[10px] text-muted-foreground">Your legal companion</div>
        </div>
      </div>
      {/* Search */}
      <div className="p-3 border-b border-sidebar-border">
        <SearchPalette />
      </div>
      <nav className="flex-1 overflow-y-auto nyaya-scroll px-3 py-3" aria-label="Main navigation">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4 last:mb-0">
            <div
              className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
              aria-hidden
            >
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
                      aria-current={active ? "page" : undefined}
                      title={item.description}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        item.tone === "emergency" && !active && "text-emergency/90",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", item.tone === "emergency" && "text-emergency")} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
        <div className="px-1"><LanguageSwitcher /></div>
        <Link
          href="/login"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogIn className="h-4 w-4" />
          <span>Sign in</span>
        </Link>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Toggle dark mode"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>Toggle theme</span>
        </button>
        <div className="px-3 pt-1 border-t border-sidebar-border/50">
          <KeyboardShortcuts />
        </div>
      </div>
    </aside>
  );
}

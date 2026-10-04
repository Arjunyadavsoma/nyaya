"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-config";
import { cn } from "@/lib/utils";
import { Scale, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { SearchPalette } from "@/components/common/search-palette";
import { KeyboardShortcuts } from "@/components/common/keyboard-shortcuts";

export function DesktopSidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary text-primary-foreground">
          <Scale className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-bold text-lg text-sidebar-foreground">Nyaya</div>
          <div className="text-[10px] text-muted-foreground">Know your rights</div>
        </div>
      </div>
      {/* Search */}
      <div className="p-3 border-b border-sidebar-border">
        <SearchPalette />
      </div>
      <nav className="flex-1 overflow-y-auto nyaya-scroll px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
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

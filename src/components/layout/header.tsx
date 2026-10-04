"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, Moon, Sun, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { NAV_ITEMS } from "./nav-config";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { SearchPalette } from "@/components/common/search-palette";

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
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
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" /> Nyaya
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-4">
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
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

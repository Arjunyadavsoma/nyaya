"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV } from "./nav-config";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 border-t border-border/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5 h-14">
        {PRIMARY_NAV.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const isEmergency = item.tone === "emergency";
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-full text-[9px] font-medium transition-colors relative",
                  isActive
                    ? isEmergency
                      ? "text-emergency"
                      : "text-primary"
                    : "text-muted-foreground/70 active:text-foreground"
                )}
              >
                <span className="relative">
                  <Icon className={cn("h-[22px] w-[22px]", isEmergency && "h-6 w-6")} />
                  {isEmergency && (
                    <span className="absolute -inset-1.5 rounded-full emergency-pulse -z-10" />
                  )}
                </span>
                <span>{item.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="tab-indicator"
                    className={cn(
                      "absolute top-0 h-0.5 w-8 rounded-full",
                      isEmergency ? "bg-emergency" : "bg-primary"
                    )}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { BottomTabBar } from "./bottom-tab-bar";
import { DesktopSidebar } from "./desktop-sidebar";
import { Header } from "./header";
import { Footer } from "./footer";
import { DisclaimerBanner } from "@/components/common/disclaimer";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide footer + bottom bar on chat page (chat needs full viewport)
  const isChat = pathname === "/chat";

  return (
    <div className={cn("flex flex-col", isChat ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]")}>
      {/* Desktop: sidebar + main */}
      <div className="flex flex-1 min-h-0">
        <DesktopSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {!isChat && <Header />}
          <main className={cn("flex-1 min-h-0", !isChat && "pb-14 lg:pb-0")}>
            {children}
          </main>
          {!isChat && <Footer />}
        </div>
      </div>
      {!isChat && <BottomTabBar />}
    </div>
  );
}

export { DisclaimerBanner };

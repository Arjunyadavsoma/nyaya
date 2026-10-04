"use client";

import { usePathname } from "next/navigation";
import { BottomTabBar } from "./bottom-tab-bar";
import { DesktopSidebar } from "./desktop-sidebar";
import { Header } from "./header";
import { Footer } from "./footer";
import { DisclaimerBanner } from "@/components/common/disclaimer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide footer on chat page (chat needs full viewport height)
  const hideFooter = pathname === "/chat";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Desktop: sidebar + main */}
      <div className="flex flex-1">
        <DesktopSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 pb-20 lg:pb-0">
            {children}
          </main>
          {!hideFooter && <Footer />}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}

export { DisclaimerBanner };

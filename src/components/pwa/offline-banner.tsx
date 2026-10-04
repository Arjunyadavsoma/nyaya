"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[60] bg-amber-500 text-amber-950 text-center text-xs font-medium py-1.5 px-4 flex items-center justify-center gap-2"
    >
      <Bell className="h-3.5 w-3.5" />
      You are offline. Emergency playbooks and saved rights articles remain available.
    </div>
  );
}

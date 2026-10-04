import { Suspense } from "react";
import { ChatWindow } from "@/components/chat/chat-window";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-6rem)] p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <ChatWindow />
    </Suspense>
  );
}

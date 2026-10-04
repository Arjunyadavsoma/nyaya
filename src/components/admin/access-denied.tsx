import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Rendered by the (admin) layout when the current user is below the editor
 * role threshold. Provides a clear, accessible exit back to the user app.
 */
export function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emergency/10 text-emergency">
          <ShieldX className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The Nyaya admin CMS requires an editor, legal reviewer, or super
            admin role. Your account does not have permission to view this area.
          </p>
        </div>
        <Button asChild>
          <Link href="/">Back to Nyaya app</Link>
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

/**
 * DPDP-compliant data deletion. Calls DELETE /api/profile which in turn
 * invokes deleteUserData() — removes all bookmarks, chat history, feedback,
 * reports, profile, and the user row itself, then clears the session cookie.
 */
export function DataDeletionCard() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete data");
        toast.success("Your data has been erased");
        setOpen(false);
        // Reload to land as a fresh guest
        setTimeout(() => window.location.reload(), 600);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <Card className="border-emergency/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-emergency">
          <ShieldAlert className="h-4 w-4" />
          Delete My Data
        </CardTitle>
        <CardDescription>
          Erase all your bookmarks, chat history, feedback, and account from
          Nyaya. This action cannot be undone — your data will be permanently
          deleted as required by the DPDP Act, 2023.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-3.5 w-3.5" />
              Delete all my data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Permanently delete all your data?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will erase your bookmarks, chat sessions, feedback, reports,
                profile, and account. You will be returned to the home page as a
                new guest. <strong>This action cannot be undone.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={isPending}
                className="bg-emergency text-white hover:bg-emergency/90"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Erasing…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Yes, delete everything
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

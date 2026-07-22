"use client";

import { BadgeCheck, KeyRound, MailWarning } from "lucide-react";

import { Spinner } from "@/components/feedback/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSendPasswordReset } from "@/features/profile/hooks/use-update-profile";
import type { User } from "@/types/auth";

export function SecurityCard({ user }: { user: User }) {
  const sendReset = useSendPasswordReset();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Security</CardTitle>
        <CardDescription>Sign-in and account protection.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="flex min-w-0 items-center gap-3">
            {user.is_verified ? (
              <BadgeCheck className="h-5 w-5 shrink-0 text-found" aria-hidden />
            ) : (
              <MailWarning className="h-5 w-5 shrink-0 text-processing" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">Sign-in email</p>
            </div>
          </div>
          <Badge variant={user.is_verified ? "found" : "processing"}>
            {user.is_verified ? "Verified" : "Unverified"}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">
                We&apos;ll email you a secure reset link. Changing your password
                signs out all other sessions.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendReset.mutate(user.email)}
            disabled={sendReset.isPending}
          >
            {sendReset.isPending ? <Spinner /> : null}
            Send reset link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

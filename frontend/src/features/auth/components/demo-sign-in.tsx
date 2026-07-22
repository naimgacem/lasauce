"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { api } from "@/services";
import { useAuthStore } from "@/store/auth.store";

/**
 * Mock-mode convenience: one click mints a demo session so the authenticated
 * shell can be exercised before the real auth screens ship. Renders nothing
 * when mocks are off.
 */
export function DemoSignIn() {
  const [pending, setPending] = React.useState(false);

  if (!env.useMocks) return null;

  async function signIn() {
    setPending(true);
    try {
      const session = await api.auth.login({
        email: "demo@lostfound.app",
        password: "demo-password",
      });
      useAuthStore.getState().setSession(session);
      toast.success("Signed in with the demo account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={signIn} disabled={pending} className="w-full">
      {pending ? <Spinner /> : <Sparkles className="h-4 w-4" />}
      Continue with demo account
    </Button>
  );
}

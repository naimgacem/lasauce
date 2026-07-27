"use client";

import * as React from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firebaseAuth } from "@/lib/firebase";
import { api } from "@/services";
import { useAuthStore } from "@/store/auth.store";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);

    try {
      if (mode === "register") {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        const session = {
          access_token: await userCredential.user.getIdToken(),
          refresh_token: "firebase",
          user: {
            id: userCredential.user.uid,
            email: userCredential.user.email ?? email,
            full_name: userCredential.user.displayName ?? email.split("@")[0],
            phone: null,
            is_verified: userCredential.user.emailVerified,
            created_at: new Date().toISOString(),
          },
        };
        useAuthStore.getState().setSession(session);
        toast.success("Account created");
      } else {
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const session = {
          access_token: await userCredential.user.getIdToken(),
          refresh_token: "firebase",
          user: {
            id: userCredential.user.uid,
            email: userCredential.user.email ?? email,
            full_name: userCredential.user.displayName ?? email.split("@")[0],
            phone: null,
            is_verified: userCredential.user.emailVerified,
            created_at: new Date().toISOString(),
          },
        };
        useAuthStore.getState().setSession(session);
        toast.success("Signed in");
      }
    } catch (error: any) {
      toast.error(error?.message || "Authentication failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

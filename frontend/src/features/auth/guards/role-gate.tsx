"use client";

import * as React from "react";

import { useSession } from "@/features/auth/hooks/use-session";
import type { UserRole } from "@/types/auth";

/**
 * Renders children only when the session user has one of the allowed roles.
 * UI-level convenience — the backend remains the actual enforcer.
 */
export function RoleGate({
  roles,
  fallback = null,
  children,
}: {
  roles: UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, isAuthed } = useSession();

  if (!isAuthed || !user || !roles.includes(user.role)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

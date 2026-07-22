"use client";

import * as React from "react";
import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";

import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

/** Composition root: theme → motion → query → auth → app + toaster. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* LazyMotion + `m.*` keeps the motion runtime small; reducedMotion="user"
          disables transform/opacity animation when the OS asks for less motion. */}
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <QueryProvider>
            <AuthProvider>
              {children}
              <Toaster richColors closeButton position="top-right" />
            </AuthProvider>
          </QueryProvider>
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}

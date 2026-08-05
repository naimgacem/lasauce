"use client";

import { m } from "framer-motion";

import { pageVariants } from "@/animations";

/**
 * App Router page transition: template.tsx remounts on every navigation,
 * giving each page a subtle fade + upward entry. No exit animation — keeps
 * navigation feeling instant.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div variants={pageVariants} initial="initial" animate="enter">
      {children}
    </m.div>
  );
}

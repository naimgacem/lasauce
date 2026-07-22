"use client";

import { useEffect, useState } from "react";

/** True only after the first client render — guards hydration mismatches. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

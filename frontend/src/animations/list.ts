import type { Variants } from "framer-motion";

import { DURATION, EASE_OUT } from "./easing";

/** Staggered list reveal — subtle fade-up items, 50ms apart. */
export const listContainer: Variants = {
  initial: {},
  enter: {
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

/** Horizontal variant for strips and rails. */
export const listItemFromLeft: Variants = {
  initial: { opacity: 0, x: -12 },
  enter: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

/**
 * Stagger that shortens as the list grows, so a 40-item grid finishes in about
 * the same time as a 6-item one. Without this, long lists visibly crawl.
 */
export function staggerFor(count: number): Variants {
  const step = count > 0 ? Math.min(0.05, 0.6 / count) : 0.05;
  return {
    initial: {},
    enter: { transition: { staggerChildren: step, delayChildren: 0.02 } },
  };
}

import type { Variants } from "framer-motion";

import { DURATION, EASE_OUT } from "./easing";

/**
 * Scroll-triggered reveal for below-the-fold sections. Fires once — content
 * that re-animates every time it scrolls back into view is distracting.
 *
 * Usage: <m.div {...revealOnce} variants={revealUp} />
 */
export const revealUp: Variants = {
  initial: { opacity: 0, y: 16 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE_OUT },
  },
};

/** Spread onto a motion element to run `revealUp` on first scroll-in. */
export const revealOnce = {
  initial: "initial",
  whileInView: "enter",
  viewport: { once: true, margin: "-80px" },
} as const;

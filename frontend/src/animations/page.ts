import type { Transition, Variants } from "framer-motion";

import { DURATION, EASE_OUT } from "./easing";

/** Page entry: fade + slight upward motion, no exit drama. */
export const pageTransition: Transition = {
  duration: DURATION.slow,
  ease: EASE_OUT,
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: pageTransition },
};

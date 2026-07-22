import type { Transition, Variants } from "framer-motion";

/** Page entry: fade + slight upward motion. 300ms ease-out, no exit drama. */
export const pageTransition: Transition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1],
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: pageTransition },
};

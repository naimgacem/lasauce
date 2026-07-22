import type { Variants } from "framer-motion";

/** Staggered list reveal — 50ms between children, subtle fade-up items. */
export const listContainer: Variants = {
  initial: {},
  enter: {
    transition: { staggerChildren: 0.05 },
  },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

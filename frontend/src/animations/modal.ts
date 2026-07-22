import type { Variants } from "framer-motion";

/** Dialog: scale 0.97 → 1 with fade. Overlay: plain fade. 200ms. */
export const modalOverlay: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.15, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: "easeIn" } },
};

export const modalContent: Variants = {
  initial: { opacity: 0, scale: 0.97 },
  enter: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

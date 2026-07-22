import type { Transition } from "framer-motion";

/**
 * Card hover: 3px lift, ≤1.01 scale. Shadow transitions via the CSS class
 * (`transition-shadow`) so the GPU only animates transform here.
 */
export const cardHoverTransition: Transition = {
  duration: 0.18,
  ease: "easeOut",
};

export const cardHover = {
  y: -3,
  scale: 1.005,
  transition: cardHoverTransition,
} as const;

export const cardTap = { scale: 0.995 } as const;

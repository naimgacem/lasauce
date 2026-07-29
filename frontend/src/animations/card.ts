import type { Transition } from "framer-motion";

import { DURATION, EASE_OUT } from "./easing";

/**
 * Card hover: small lift, ≤1.01 scale. Shadow and border transition via CSS
 * (`transition-shadow`) so the GPU only ever animates transform here.
 */
export const cardHoverTransition: Transition = {
  duration: DURATION.fast,
  ease: EASE_OUT,
};

export const cardHover = {
  y: -4,
  scale: 1.006,
  transition: cardHoverTransition,
} as const;

export const cardTap = {
  scale: 0.994,
  transition: { duration: DURATION.instant },
} as const;

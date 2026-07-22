/**
 * Centralized animation system — subtle, professional motion only.
 *
 * Ground rules (enforced here, not per-component):
 * - Page transitions: fade + ≤8px upward, 250–350ms.
 * - Cards: 2–4px hover lift, scale ≤1.01, shadow via CSS.
 * - Lists: 40–60ms stagger.
 * - Dialogs: 0.97 → 1 scale + fade.
 * - Buttons: micro-interactions only (active scale via CSS), no bounce.
 * - `prefers-reduced-motion` respected globally via
 *   `<MotionConfig reducedMotion="user">` in AppProviders.
 * - Bundle: components use `m.*` under `<LazyMotion features={domAnimation}>`
 *   (~5kb instead of the full motion runtime).
 *
 * Forbidden: parallax, springs with visible overshoot, large scaling,
 * startup theatrics.
 */
export { pageTransition, pageVariants } from "./page";
export { cardHover, cardHoverTransition, cardTap } from "./card";
export { listContainer, listItem } from "./list";
export { modalContent, modalOverlay } from "./modal";

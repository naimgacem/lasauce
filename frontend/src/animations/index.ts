/**
 * Centralized animation system — subtle, professional motion only.
 *
 * Ground rules (enforced here, not per-component):
 * - One easing curve for entrances: `EASE_OUT`, a decelerating cubic.
 * - Nothing that is server-rendered animates in. Content that arrives with the
 *   HTML must paint with it; an entrance from opacity 0 hides it until
 *   JavaScript runs. Entrances are for things that arrive later (fetched lists,
 *   wizard steps).
 * - Cards: one CSS hover response (border tint, or a slow push into the photo).
 *   No lift — a card that jumps at the cursor reads as a toy.
 * - Lists: 40–60ms stagger, capped so long lists never crawl.
 * - Dialogs: 0.97 → 1 scale + fade.
 * - Buttons: micro-interactions only (active scale via CSS), no bounce.
 * - `prefers-reduced-motion` respected globally via
 *   `<MotionConfig reducedMotion="user">` in AppProviders, plus a CSS guard in
 *   globals.css for keyframe animations Framer Motion never sees.
 * - Bundle: components use `m.*` under `<LazyMotion features={domAnimation}>`
 *   (~5kb instead of the full motion runtime).
 *
 * Forbidden: parallax, springs with visible overshoot, large scaling,
 * startup theatrics, anything that loops in the user's peripheral vision.
 */
export { EASE_OUT, DURATION } from "./easing";
export { pageTransition, pageVariants } from "./page";
export { listContainer, listItem, listItemFromLeft, staggerFor } from "./list";
export { modalContent, modalOverlay } from "./modal";

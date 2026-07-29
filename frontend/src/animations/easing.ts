/**
 * The house curve and duration scale. Every animation in the product pulls
 * from these so timing stays coherent across features.
 */

/** Decelerating ease-out — fast start, soft landing. Used for all entrances. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Symmetric ease for state changes that aren't entrances (e.g. progress bars). */
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

export const DURATION = {
  /** Hover/press feedback — must feel instant. */
  instant: 0.12,
  /** Micro-interactions: toggles, chips, small reveals. */
  fast: 0.18,
  /** The default for most entrances. */
  base: 0.26,
  /** Page-level transitions and larger reveals. */
  slow: 0.34,
  /** Deliberate, one-off reveals (the confidence ring). */
  deliberate: 0.8,
} as const;

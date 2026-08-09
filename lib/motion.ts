import type { Transition, Variants } from "motion/react";

/**
 * Motion tokens. Durations stay inside the 150 to 300ms band the rest of the
 * interface uses, on the same easing curve as the CSS transitions.
 */
export const EASE_OUT_SOFT = [0.16, 1, 0.3, 1] as const;

export const transition = {
  fast: { duration: 0.15, ease: EASE_OUT_SOFT },
  base: { duration: 0.22, ease: EASE_OUT_SOFT },
  slow: { duration: 0.3, ease: EASE_OUT_SOFT },
} satisfies Record<string, Transition>;

/** Entry used by section reveals. Distance stays small on purpose. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export const viewportOnce = { once: true, amount: 0.25 } as const;

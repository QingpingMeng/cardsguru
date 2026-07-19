import type { Transition, Variants } from 'framer-motion';

/** Snappy spring used for presses and small UI movements. */
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 };

/** Softer spring for larger surfaces (sheets, cards entering). */
export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 28 };

/** Fade + rise, for list items and cards. */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
};

/** Simple cross-fade. */
export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Stagger container for lists. */
export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

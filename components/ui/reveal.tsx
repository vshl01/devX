"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { EASE_OUT_SOFT, revealVariants, viewportOnce } from "@/lib/motion";

/**
 * Entry animation for section content. Communicates reading order as the page
 * scrolls; collapses to a plain render under reduced motion.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      variants={revealVariants}
      initial={reduced ? false : "hidden"}
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ duration: 0.3, delay, ease: EASE_OUT_SOFT }}
    >
      {children}
    </Tag>
  );
}

"use client";

import { List, X } from "@phosphor-icons/react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { useRef, useState } from "react";

import { CallWidget } from "@/components/call/call-widget";
import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { EASE_OUT_SOFT, transition } from "@/lib/motion";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#example", label: "Example" },
  { href: "#limits", label: "Limits" },
];

/** Ignore jitter so the bar does not flicker on trackpad noise. */
const DIRECTION_THRESHOLD = 8;
/** Above the hero the bar is always shown. */
const ALWAYS_VISIBLE_UNTIL = 96;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lifted, setLifted] = useState(false);

  const lastY = useRef(0);
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    const delta = y - lastY.current;
    if (Math.abs(delta) < DIRECTION_THRESHOLD) return;
    lastY.current = y;

    setLifted(y > 12);

    // Scrolling down gets out of the way; scrolling up brings the bar back.
    if (open || y < ALWAYS_VISIBLE_UNTIL) setHidden(false);
    else setHidden(delta > 0);
  });

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-40"
      animate={{ y: hidden && !reduced ? "-105%" : "0%" }}
      initial={false}
      transition={{ duration: 0.28, ease: EASE_OUT_SOFT }}
    >
      <div
        data-lifted={lifted || open}
        className="glass-nav border-b border-transparent transition-[background-color,border-color,box-shadow] duration-300 ease-out-soft data-[lifted=true]:border-line"
      >
        <Container>
          <nav aria-label="Main" className="flex h-16 items-center justify-between gap-6">
            <a href="#top" className="rounded-md" aria-label="Lucid, home">
              <Logo />
            </a>

            <ul className="hidden items-center gap-1 md:flex">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex h-9 items-center rounded-full px-3 text-sm text-ink-soft transition-colors duration-150 hover:bg-sunken hover:text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <CallWidget />
              <LinkButton href="#top" size="sm" className="hidden sm:inline-flex">
                Read a report
              </LinkButton>
              <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-controls="mobile-nav"
                aria-label={open ? "Close menu" : "Open menu"}
                className="flex size-9 items-center justify-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-sunken hover:text-ink md:hidden"
              >
                {open ? <X size={19} /> : <List size={19} />}
              </button>
            </div>
          </nav>
        </Container>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id="mobile-nav"
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={transition.base}
              className="overflow-hidden border-t border-line md:hidden"
            >
              <Container>
                <ul className="flex flex-col py-2">
                  {LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-2 py-3 text-[15px] text-ink-soft transition-colors duration-150 hover:bg-sunken hover:text-ink"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                  <li className="pt-1 pb-3 sm:hidden">
                    <LinkButton href="#top" size="sm" onClick={() => setOpen(false)}>
                      Read a report
                    </LinkButton>
                  </li>
                </ul>
              </Container>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

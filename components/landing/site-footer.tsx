import Link from "next/link";
import { FileText, Phone } from "@phosphor-icons/react/dist/ssr";

import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/call-agent", label: "AI Call Agent" },
      { href: "/prescription", label: "Prescription Companion" },
      { href: "#how-it-works", label: "How it works" },
    ],
  },
  {
    heading: "Experience",
    links: [
      { href: "#prescription", label: "Understand prescriptions" },
      { href: "#ask", label: "Ask Your Prescription" },
      { href: "#languages", label: "Languages" },
    ],
  },
  {
    heading: "Trust",
    links: [
      { href: "#trust", label: "Safety" },
      { href: "#sarvam", label: "Why Sarvam" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-sunken">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              AI-powered healthcare access and prescription understanding — built for patients who
              deserve clarity in their own language.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-ink-mute">
              <span className="inline-flex items-center gap-1.5">
                <Phone size={14} aria-hidden /> Call Agent
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText size={14} aria-hidden /> Prescription Companion
              </span>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="text-[13px] font-semibold text-ink">{column.heading}</h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-soft transition-colors duration-150 hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-mute">
            Doctor AI helps patients understand information already provided by their doctor. It
            does not diagnose or replace medical advice.
          </p>
          <p className="text-xs text-ink-mute">Powered by Sarvam AI · © 2026 Doctor AI</p>
        </div>
      </Container>
    </footer>
  );
}

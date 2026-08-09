import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarBlank, Phone } from "@phosphor-icons/react/dist/ssr";

import { CallWidget } from "@/components/call/call-widget";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "AI Call Agent · Doctor AI Front Desk",
  description:
    "Call the clinic’s AI receptionist to check calendar availability and book an appointment.",
};

export default function CallAgentPage() {
  return (
    <div className="min-h-full bg-canvas">
      <header className="border-b border-line bg-surface/80 backdrop-blur-md">
        <Container className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="rounded-md" aria-label="Doctor AI home">
            <Logo />
          </Link>
          <Link
            href="/prescription"
            className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Prescription Companion
          </Link>
        </Container>
      </header>

      <main>
        <Container className="py-12 sm:py-16">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} aria-hidden />
            Back to Doctor AI
          </Link>

          <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-[13px] font-medium tracking-[0.14em] text-accent uppercase">
                AI Call Agent
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Book an appointment just by talking.
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-soft">
                Call the clinic&apos;s AI receptionist. Speak naturally, review available slots from
                the connected calendar, and confirm your booking.
              </p>

              <ul className="mt-6 space-y-2.5 text-sm text-ink">
                <li className="flex items-center gap-2">
                  <Phone size={16} className="text-accent" aria-hidden />
                  Natural multilingual voice conversation
                </li>
                <li className="flex items-center gap-2">
                  <CalendarBlank size={16} className="text-accent" aria-hidden />
                  Live availability from the clinic calendar
                </li>
              </ul>

              <div className="mt-8">
                <CallWidget />
              </div>

              <p className="mt-4 max-w-md text-xs leading-relaxed text-ink-mute">
                This agent serves the authenticated clinic calendar for this deployment. It does
                not browse a universal doctor network.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-mute uppercase">
                Example conversation
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-lg bg-sunken px-3 py-2.5">
                  <p className="text-[11px] font-medium text-ink-mute uppercase">Patient</p>
                  <p className="mt-1 text-ink">“I need an appointment tomorrow evening.”</p>
                </div>
                <div className="rounded-lg border border-accent-line bg-accent-soft/50 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-accent uppercase">AI</p>
                  <p className="mt-1 text-ink">
                    “I found three available slots: 5:30 PM, 6:00 PM and 6:30 PM. Which works for
                    you?”
                  </p>
                </div>
                <div className="rounded-lg bg-sunken px-3 py-2.5">
                  <p className="text-[11px] font-medium text-ink-mute uppercase">Patient</p>
                  <p className="mt-1 text-ink">“6 PM.”</p>
                </div>
                <div className="rounded-lg border border-accent-line bg-accent-soft/50 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-accent uppercase">AI</p>
                  <p className="mt-1 text-ink">“Your appointment is booked for 6:00 PM.”</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}

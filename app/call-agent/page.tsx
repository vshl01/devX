import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { CallAgentSection } from "@/components/call/call-agent-section";
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

          <CallAgentSection />
        </Container>
      </main>
    </div>
  );
}

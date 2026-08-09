import Link from "next/link";
import { FileText, Microphone, Phone } from "@phosphor-icons/react/dist/ssr";

import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

export function LandingHero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_0%,var(--accent-soft),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent"
      />

      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <Reveal>
              <p className="text-[13px] font-medium tracking-[0.14em] text-accent uppercase">
                Doctor AI Front Desk
              </p>
            </Reveal>
            <Reveal delay={0.04}>
              <h1 className="mt-4 max-w-xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-5xl lg:text-[3.25rem]">
                Book appointments. Understand prescriptions. Speak in your language.
              </h1>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-pretty text-ink-soft">
                A multilingual AI front desk that helps patients book visits by voice and understand
                handwritten prescriptions — powered by Sarvam AI.
              </p>
            </Reveal>

            <Reveal delay={0.12} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <LinkButton href="/call-agent" className="justify-center">
                <Phone size={18} weight="fill" aria-hidden />
                Try AI Call Agent
              </LinkButton>
              <LinkButton href="/prescription" variant="secondary" className="justify-center">
                <FileText size={18} weight="duotone" aria-hidden />
                Try Prescription Companion
              </LinkButton>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-5 text-xs tracking-wide text-ink-mute">
                Powered by Sarvam AI · Multilingual Voice · Document Intelligence
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <HeroCallCard />
            <HeroRxCard />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function HeroCallCard() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-md">
      <div className="flex items-center gap-2 text-accent">
        <Phone size={18} weight="duotone" aria-hidden />
        <p className="text-[11px] font-semibold tracking-[0.08em] uppercase">AI Call Agent</p>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        <div className="rounded-lg bg-sunken px-3 py-2.5 text-ink-soft">
          <p className="text-[11px] font-medium text-ink-mute uppercase">Patient</p>
          <p className="mt-1">“I need an appointment tomorrow evening.”</p>
        </div>
        <div className="rounded-lg border border-accent-line bg-accent-soft/60 px-3 py-2.5 text-ink">
          <p className="text-[11px] font-medium text-accent uppercase">AI</p>
          <p className="mt-1">“6:00 PM is available. Shall I book it?”</p>
        </div>
      </div>
      <Link
        href="/call-agent"
        className="mt-4 inline-flex text-sm font-medium text-accent transition-colors hover:text-accent-hover"
      >
        Open Call Agent →
      </Link>
    </div>
  );
}

function HeroRxCard() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-md">
      <div className="flex items-center gap-2 text-accent">
        <FileText size={18} weight="duotone" aria-hidden />
        <p className="text-[11px] font-semibold tracking-[0.08em] uppercase">
          Prescription Companion
        </p>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="rounded-lg border border-dashed border-line-strong bg-sunken/70 px-3 py-4 text-center text-ink-mute">
          Handwritten prescription
        </div>
        <div className="rounded-lg bg-sunken px-3 py-2.5 text-ink">
          <p className="text-[11px] font-medium text-ink-mute uppercase">ಕನ್ನಡ</p>
          <p className="mt-1.5 leading-relaxed">
            ರಕ್ತದೊತ್ತಡ: 120/80
            <br />
            ಔಷಧಿ: Metformin 500 mg
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
          <Microphone size={14} aria-hidden /> Ask Your Prescription
        </p>
      </div>
      <Link
        href="/prescription"
        className="mt-3 inline-flex text-sm font-medium text-accent transition-colors hover:text-accent-hover"
      >
        Open Companion →
      </Link>
    </div>
  );
}

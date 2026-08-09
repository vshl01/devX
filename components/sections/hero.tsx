import { Composer } from "@/components/composer/composer";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

export function Hero() {
  return (
    <section id="top" className="relative flex min-h-[100dvh] items-center pt-24 pb-16">
      {/* Single quiet wash behind the composer. Fixed and inert, so it never
          repaints while the page scrolls. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_28%,var(--accent-soft),transparent_70%)]"
      />

      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-5xl lg:text-[3.5rem]">
              Your medical report, explained in plain language.
            </h1>
          </Reveal>

          <Reveal delay={0.06}>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-soft">
              Upload a lab result or scan report. Ask what a number means, out loud or in writing.
            </p>
          </Reveal>

          <Reveal delay={0.12} className="mt-9">
            <Composer />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

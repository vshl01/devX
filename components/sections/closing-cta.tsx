import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

export function ClosingCta() {
  return (
    <section className="border-t border-line bg-sunken py-24 sm:py-28">
      <Container>
        <Reveal className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            You should not need a translator for your own health
          </h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Start with the report sitting in your inbox right now.
          </p>
          <LinkButton href="#top" className="mt-7">
            Read a report
          </LinkButton>
        </Reveal>
      </Container>
    </section>
  );
}

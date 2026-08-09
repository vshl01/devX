import { ChatCircleDots, Microphone, UploadSimple } from "@phosphor-icons/react/dist/ssr";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

const STEPS = [
  {
    icon: UploadSimple,
    title: "Attach the report",
    body: "Drop in the PDF from the lab, or photograph the printout. Lucid pulls the text out and lines up every marker with its reference range.",
  },
  {
    icon: ChatCircleDots,
    title: "Read it in your own words",
    body: "Each result comes back as a sentence, not a verdict: what the marker measures, where your value sits, and whether it is the kind of number worth a phone call.",
  },
  {
    icon: Microphone,
    title: "Ask out loud",
    body: "Hold the mic and talk. Speech goes to Sarvam, so questions in Hindi, Tamil, Bengali and seven more Indian languages land as text and come back answered.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-28">
      <Container>
        <Reveal>
          <h2 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            Three minutes between the report and understanding it
          </h2>
        </Reveal>

        <ol className="relative mt-14 flex flex-col gap-12 pl-14 sm:gap-14">
          <span
            aria-hidden
            className="rail-line absolute top-2 bottom-2 left-[19px] w-px"
          />

          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 0.06} className="relative">
              <span
                aria-hidden
                className="absolute top-0 -left-14 flex size-10 items-center justify-center rounded-full border border-line bg-surface text-accent"
              >
                <step.icon size={19} />
              </span>
              <h3 className="text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
              <p className="mt-2 max-w-[62ch] leading-relaxed text-ink-soft">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

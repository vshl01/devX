import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

const LIMITS = [
  {
    title: "It does not diagnose",
    body: "Lucid describes what a result measures and where yours sits. Naming a condition is your clinician's job, with your history in front of them.",
  },
  {
    title: "It never changes your treatment",
    body: "No dosage suggestions, no starting or stopping anything. If a result reads as urgent, it says so and tells you to seek care now.",
  },
  {
    title: "Your report is not kept",
    body: "Files are read in memory to answer your question and are never written to disk. Nothing is stored between sessions.",
  },
  {
    title: "It says when it cannot read",
    body: "A blurred photo or a scan with no text layer gets flagged as unreadable rather than filled in with a guess.",
  },
];

export function Limits() {
  return (
    <section id="limits" className="py-24 sm:py-28">
      <Container>
        <Reveal>
          <h2 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            The boundaries, stated up front
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-x-16 gap-y-10 sm:grid-cols-2">
          {LIMITS.map((limit, index) => (
            <Reveal key={limit.title} delay={index * 0.05}>
              <h3 className="text-[15px] font-semibold text-ink">{limit.title}</h3>
              <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-ink-soft">
                {limit.body}
              </p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

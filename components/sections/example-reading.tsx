import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

/**
 * A real render of the result component with sample values, not a picture of
 * one. The numbers are illustrative and labelled as such.
 */
const SAMPLE_MARKERS = [
  {
    name: "Haemoglobin",
    value: "11.2 g/dL",
    range: "13.0 to 17.0",
    flag: "low" as const,
    note: "Below the range used for adult men. Common with low iron, and worth a follow up rather than an alarm.",
  },
  {
    name: "TSH",
    value: "6.8 mIU/L",
    range: "0.4 to 4.0",
    flag: "high" as const,
    note: "The pituitary is pushing the thyroid harder than usual. Doctors normally repeat this with a free T4 before concluding anything.",
  },
  {
    name: "Fasting glucose",
    value: "92 mg/dL",
    range: "70 to 99",
    flag: "normal" as const,
    note: "Sits comfortably inside the range.",
  },
];

const FLAG_LABEL = { low: "Below range", high: "Above range", normal: "In range" };

export function ExampleReading() {
  return (
    <section id="example" className="border-t border-line bg-sunken py-24 sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <Reveal className="lg:sticky lg:top-28">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-ink sm:text-4xl">
              Every number gets a sentence
            </h2>
            <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-soft">
              A flagged value on its own only creates worry. Lucid says what the marker does, how
              far outside the range you are, and what a clinician usually checks next.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-lg border border-line bg-surface shadow-md">
              <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
                <p className="text-[13px] font-medium text-ink">Blood panel, sample reading</p>
                <p className="text-xs text-ink-mute">Illustrative values</p>
              </div>

              <ul>
                {SAMPLE_MARKERS.map((marker, index) => (
                  <li
                    key={marker.name}
                    className={index > 0 ? "border-t border-line px-5 py-4" : "px-5 py-4"}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="font-medium text-ink">{marker.name}</p>
                      <p className="font-mono text-[15px] text-ink tabular-nums">{marker.value}</p>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span
                        className={
                          marker.flag === "normal"
                            ? "rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"
                            : "rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger"
                        }
                      >
                        {FLAG_LABEL[marker.flag]}
                      </span>
                      <span className="font-mono text-xs text-ink-mute tabular-nums">
                        ref {marker.range}
                      </span>
                    </div>

                    <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">{marker.note}</p>
                  </li>
                ))}
              </ul>

              <p className="border-t border-line px-5 py-3.5 text-xs text-ink-mute">
                Ask a follow up on any line, by voice or by typing.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

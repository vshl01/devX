import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

const REPORT_TYPES = [
  "Complete blood count",
  "Lipid profile",
  "Thyroid panel",
  "HbA1c and glucose",
  "Liver function",
  "Kidney function",
  "Vitamin D and B12",
  "Radiology impression",
  "Discharge summary",
  "Prescription list",
];

/** Breadth, without a wall of logos this product has not earned yet. */
export function SupportedReports() {
  return (
    <section aria-labelledby="reports-heading" className="border-y border-line bg-sunken py-12">
      <Container>
        <Reveal className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-10">
          <h2
            id="reports-heading"
            className="shrink-0 text-sm font-medium text-ink-soft lg:max-w-[13rem]"
          >
            Reads the reports people actually get handed
          </h2>

          <ul className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
            {REPORT_TYPES.map((type) => (
              <li
                key={type}
                className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] whitespace-nowrap text-ink-soft"
              >
                {type}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "#how-it-works", label: "How it works" },
      { href: "#example", label: "Example reading" },
      { href: "#limits", label: "What it will not do" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "#top", label: "About" },
      { href: "#top", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "#top", label: "Privacy" },
      { href: "#top", label: "Terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-sunken">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              A reading assistant for your own medical reports. Built for people, reviewed against
              clinical guidance.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="text-[13px] font-semibold text-ink">{column.heading}</h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-ink-soft transition-colors duration-150 hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-mute">
            Lucid is not a medical device and does not provide diagnosis or treatment.
          </p>
          <p className="text-xs text-ink-mute">© 2026 Lucid Health</p>
        </div>
      </Container>
    </footer>
  );
}

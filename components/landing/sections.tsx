import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarBlank,
  CheckCircle,
  FileText,
  Globe,
  Microphone,
  Phone,
  ShieldCheck,
  Translate,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";

import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

export function ProblemSection() {
  return (
    <section className="border-t border-line py-16 sm:py-20">
      <Container>
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            Healthcare shouldn&apos;t be difficult to navigate.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Reveal>
            <article className="h-full border-l-2 border-accent pl-5">
              <h3 className="text-xl font-semibold tracking-tight text-ink">
                Patients shouldn&apos;t have to wait to book an appointment.
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                Patients often call clinics, wait for receptionists, and manually coordinate times.
                Our AI receptionist handles the first conversation and checks available calendar
                slots.
              </p>
            </article>
          </Reveal>
          <Reveal delay={0.06}>
            <article className="h-full border-l-2 border-accent pl-5">
              <h3 className="text-xl font-semibold tracking-tight text-ink">
                A prescription shouldn&apos;t be impossible to understand.
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                Handwriting is fast, instructions are dense, and many patients are more comfortable
                in another language. Prescription Companion makes what was written clear — without
                inventing anything.
              </p>
            </article>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

export function FeaturesSection() {
  return (
    <section id="call-agent" className="border-t border-line bg-sunken/40 py-16 sm:py-20">
      <Container>
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            Two ways Doctor AI helps patients
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <FeatureCard
              icon={<Phone size={22} weight="duotone" />}
              title="AI Call Agent"
              subtitle="Book an appointment just by talking."
              body="Patients can call the clinic’s AI receptionist, speak naturally, and find an available appointment slot. The agent checks the connected calendar and books the visit."
              bullets={[
                "Natural voice conversations",
                "Multilingual interaction",
                "Real-time calendar availability",
                "Appointment booking for the connected clinic",
              ]}
              href="/call-agent"
              cta="Try the Call Agent"
            />
          </Reveal>
          <Reveal delay={0.06}>
            <div id="prescription">
              <FeatureCard
                icon={<FileText size={22} weight="duotone" />}
                title="Prescription Companion"
                subtitle="Turn a handwritten prescription into something you can understand."
                body="Upload a doctor’s prescription and use AI to digitize, translate, and ask about information that is actually written — in the language you’re comfortable with."
                bullets={[
                  "Handwritten prescription understanding",
                  "Multilingual translation",
                  "Structured prescription information",
                  "Ask questions with text or voice",
                ]}
                href="/prescription"
                cta="Try Prescription Companion"
              />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  subtitle,
  body,
  bullets,
  href,
  cta,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  body: string;
  bullets: string[];
  href: string;
  cta: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <div className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
        {icon}
      </div>
      <h3 className="mt-5 text-2xl font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 text-[15px] font-medium text-ink-soft">{subtitle}</p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
      <ul className="mt-5 space-y-2.5">
        {bullets.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink">
            <CheckCircle size={16} className="mt-0.5 shrink-0 text-accent" weight="fill" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-8 inline-flex text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
      >
        {cta} →
      </Link>
    </article>
  );
}

const JOURNEY = [
  { n: "01", title: "Call", body: "Call the AI receptionist in your language." },
  { n: "02", title: "Book", body: "The AI checks the connected calendar." },
  { n: "03", title: "Visit", body: "Meet the doctor and receive your prescription." },
  { n: "04", title: "Upload", body: "Upload the handwritten prescription." },
  { n: "05", title: "Understand", body: "Translate it and ask questions in your language." },
];

export function JourneySection() {
  return (
    <section id="how-it-works" className="border-t border-line py-16 sm:py-20">
      <Container>
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            From appointment to prescription — one simple experience.
          </h2>
        </Reveal>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {JOURNEY.map((step, index) => (
            <Reveal key={step.n} delay={index * 0.04} as="li">
              <div className="relative h-full">
                <p className="font-mono text-xs tracking-wide text-accent">{step.n}</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

export function PrescriptionPreviewSection() {
  return (
    <section className="border-t border-line bg-sunken/40 py-16 sm:py-20">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
              Your prescription, finally understandable.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Keep the original on the left. See a clear, multilingual reading on the right — then
              ask anything that was actually written.
            </p>
            <LinkButton href="/prescription" className="mt-7">
              Explore Prescription Companion →
            </LinkButton>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-md">
              <div className="grid sm:grid-cols-2">
                <div className="border-b border-line p-4 sm:border-r sm:border-b-0">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-mute uppercase">
                    Original
                  </p>
                  <div className="mt-3 flex min-h-44 items-center justify-center rounded-lg border border-dashed border-line-strong bg-sunken/60 px-4 text-center text-sm text-ink-mute">
                    Handwritten prescription preview
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-mute uppercase">
                    ಕನ್ನಡ
                  </p>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div>
                      <dt className="text-[11px] text-ink-mute uppercase">ರೋಗಿಯ ಹೆಸರು</dt>
                      <dd className="font-medium text-ink">Ravi</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-ink-mute uppercase">ರಕ್ತದೊತ್ತಡ</dt>
                      <dd className="font-medium text-ink">120/80</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-ink-mute uppercase">ಔಷಧಿ</dt>
                      <dd className="font-medium text-ink">Metformin 500 mg</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-ink-mute uppercase">ಅವಧಿ</dt>
                      <dd className="font-medium text-ink">5 ದಿನಗಳು</dd>
                    </div>
                  </dl>
                  <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                    <Microphone size={13} aria-hidden /> Ask Your Prescription
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-mute">Demo preview — not real patient data.</p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

export function AskPreviewSection() {
  return (
    <section id="ask" className="border-t border-line py-16 sm:py-20">
      <Container>
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            Don&apos;t understand what&apos;s written? Just ask.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-accent uppercase">
                Found in prescription
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="ml-auto max-w-[90%] rounded-lg bg-accent px-3 py-2 text-on-accent">
                  “ನನ್ನ BP ಎಷ್ಟು ಇತ್ತು?”
                </div>
                <div className="max-w-[92%] rounded-lg bg-sunken px-3 py-2 text-ink">
                  “ನಿಮ್ಮ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಪ್ರಕಾರ ನಿಮ್ಮ BP 120/80 ಎಂದು ದಾಖಲಾಗಿದೆ.”
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-mute uppercase">
                Not invented
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="ml-auto max-w-[90%] rounded-lg bg-accent px-3 py-2 text-on-accent">
                  “What was my cholesterol?”
                </div>
                <div className="max-w-[92%] rounded-lg border border-line bg-sunken px-3 py-2 text-ink">
                  <p className="mb-1 text-[11px] font-medium tracking-wide text-ink-mute uppercase">
                    Not found in prescription
                  </p>
                  There is no cholesterol value recorded in this prescription. Please contact your
                  doctor for clarification.
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

export function LanguagesSection() {
  const rows = [
    { lang: "English", sample: "What was my BP?" },
    { lang: "ಕನ್ನಡ", sample: "ನನ್ನ BP ಎಷ್ಟು ಇತ್ತು?" },
    { lang: "हिन्दी", sample: "मेरा BP कितना था?" },
    { lang: "தமிழ்", sample: "என் BP எவ்வளவு?" },
  ];

  return (
    <section id="languages" className="border-t border-line bg-sunken/40 py-16 sm:py-20">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
              Healthcare in the language you&apos;re comfortable with.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Patients shouldn&apos;t have to translate their healthcare experience into a language
              they&apos;re less comfortable with. Sarvam powers the multilingual voice and language
              experience.
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.lang}
                  className="flex items-baseline justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3"
                >
                  <span className="text-xs font-semibold tracking-wide text-accent uppercase">
                    {row.lang}
                  </span>
                  <span className="text-sm text-ink">{row.sample}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

export function SarvamSection() {
  const cards = [
    {
      icon: <Microphone size={22} weight="duotone" />,
      title: "Voice AI",
      body: "Natural voice interaction for booking and asking about prescriptions.",
    },
    {
      icon: <Globe size={22} weight="duotone" />,
      title: "Multilingual AI",
      body: "Patients can interact in languages they are comfortable with.",
    },
    {
      icon: <Translate size={22} weight="duotone" />,
      title: "Document Intelligence",
      body: "Handwritten prescriptions can be digitized and understood.",
    },
  ];

  return (
    <section id="sarvam" className="border-t border-line py-16 sm:py-20">
      <Container>
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            Built for India&apos;s multilingual reality.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            Sarvam isn&apos;t just an API integration. Its voice, multilingual, and document
            intelligence capabilities are core to the patient experience.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {cards.map((card, index) => (
            <Reveal key={card.title} delay={index * 0.05}>
              <article className="h-full rounded-xl border border-line bg-surface p-5">
                <div className="text-accent">{card.icon}</div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{card.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function TrustSection() {
  const goods = [
    "Information found in the prescription",
    "Grounded answers only",
    "Original document preserved",
    "Multilingual understanding",
  ];
  const bads = ["No invented medical information", "No diagnosis or dosage changes"];

  return (
    <section id="trust" className="border-t border-line bg-sunken/40 py-16 sm:py-20">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
              AI that knows when it doesn&apos;t know.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
              Doctor AI answers prescription questions using information available in the
              patient&apos;s prescription. If something isn&apos;t recorded, it says so instead of
              guessing.
            </p>
            <p className="mt-6 flex items-start gap-2 text-sm text-ink-mute">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              Doctor AI helps patients understand information already provided by their doctor. It
              does not diagnose or replace medical advice.
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <ul className="space-y-3">
                {goods.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink">
                    <CheckCircle size={16} className="mt-0.5 text-accent" weight="fill" aria-hidden />
                    {item}
                  </li>
                ))}
                {bads.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
                    <XCircle size={16} className="mt-0.5 text-danger" weight="fill" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

export function CallPreviewSection() {
  return (
    <section className="border-t border-line py-16 sm:py-20">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
              A receptionist that answers when patients call.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
              A clinic authenticates and connects its calendar. The AI agent handles appointment
              booking for that organization — not a universal hospital network.
            </p>
            <LinkButton href="/call-agent" className="mt-7">
              <Phone size={18} weight="fill" aria-hidden />
              Try AI Call Agent
            </LinkButton>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="space-y-3 rounded-xl border border-line bg-surface p-5 shadow-sm text-sm">
              <ChatLine who="Patient" text="I need an appointment tomorrow evening." />
              <ChatLine
                who="AI"
                accent
                text="I found three available slots: 5:30 PM, 6:00 PM and 6:30 PM. Which works for you?"
              />
              <ChatLine who="Patient" text="6 PM." />
              <ChatLine who="AI" accent text="Your appointment is booked for 6:00 PM." />
              <p className="pt-2 text-xs text-ink-mute">
                <CalendarBlank size={13} className="mr-1 inline" aria-hidden />
                Connected clinic calendar · demo conversation
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function ChatLine({
  who,
  text,
  accent,
}: {
  who: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-lg border border-accent-line bg-accent-soft/50 px-3 py-2.5"
          : "rounded-lg bg-sunken px-3 py-2.5"
      }
    >
      <p className={`text-[11px] font-medium uppercase ${accent ? "text-accent" : "text-ink-mute"}`}>
        {who}
      </p>
      <p className="mt-1 text-ink">{text}</p>
    </div>
  );
}

export function FinalCtaSection() {
  return (
    <section className="border-t border-line bg-[radial-gradient(60%_80%_at_50%_0%,var(--accent-soft),transparent_70%)] py-16 sm:py-24">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            Make healthcare easier to access. And easier to understand.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-ink-soft">
            Try the AI receptionist or upload a prescription and experience Doctor AI yourself.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href="/call-agent">
              <Phone size={18} weight="fill" aria-hidden />
              Try AI Call Agent
            </LinkButton>
            <LinkButton href="/prescription" variant="secondary">
              <FileText size={18} weight="duotone" aria-hidden />
              Try Prescription Companion
            </LinkButton>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}



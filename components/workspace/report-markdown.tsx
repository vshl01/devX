"use client";

import { Warning } from "@phosphor-icons/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Children, isValidElement } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * The report renderer. Markdown gives the model a simple contract; every
 * element is mapped to a designed component here, so nothing falls back to
 * browser defaults. Result flags become badges, and the red-flag section is
 * styled as a callout.
 */

/** Flag words the model emits, in English and in each translated language. */
const FLAG_TONES: Array<{ tone: "normal" | "watch" | "alert"; match: RegExp }> = [
  { tone: "normal", match: /^(normal|in range|सामान्य|স্বাভাবিক|సాధారణ|இயல்பு|ಸಾಮಾನ್ಯ|സാധാരണ|સામાન્ય|ਸਧਾਰਨ|ସାଧାରଣ|عام)$/i },
  { tone: "watch", match: /^(borderline|slightly high|slightly low|सीमावर्ती|সীমান্তবর্তী|సరిహద్దు|எல்லைக்கோடு|ಗಡಿರೇಖೆ|അതിർത്തി|સીમારેખા|ਸਰਹੱਦੀ|ସୀମାରେଖା)$/i },
  {
    tone: "alert",
    match:
      /^(high|low|critical|abnormal|उच्च|निम्न|कम|अधिक|गंभीर|উচ্চ|নিম্ন|কম|అధిక|తక్కువ|உயர்|குறை|ಹೆಚ್ಚು|ಕಡಿಮೆ|ഉയർന്ന|കുറഞ്ഞ|ઊંચું|નીચું|ਉੱਚ|ਘੱਟ|ଉଚ୍ଚ|ନିମ୍ନ|مرتفع|منخفض)$/i,
  },
];

const TONE_CLASS = {
  normal: "border-accent-line bg-accent-soft text-accent",
  watch: "border-line-strong bg-sunken text-ink-soft",
  alert: "border-transparent bg-danger-soft text-danger",
} as const;

function toneFor(value: string): keyof typeof TONE_CLASS | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 24) return null;
  return FLAG_TONES.find((entry) => entry.match.test(trimmed))?.tone ?? null;
}

function plainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children);
  return "";
}

/** Section headings drive the layout, so the report knows where it is. */
const RED_FLAG_HEADINGS = /red flag|urgent|seek care|चेतावनी|警/i;

export function ReportMarkdown({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-7", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="text-xl font-semibold tracking-tight text-ink">{children}</h3>
          ),
          h2: ({ children }) => {
            const label = plainText(children);
            const isRedFlag = RED_FLAG_HEADINGS.test(label);
            return (
              <h3
                className={cn(
                  "flex items-center gap-2 border-b border-line pt-1 pb-2 text-[13px] font-semibold tracking-[0.02em] first:pt-0",
                  isRedFlag ? "text-danger" : "text-ink",
                )}
              >
                {isRedFlag ? <Warning size={15} weight="fill" aria-hidden /> : null}
                {children}
              </h3>
            );
          },
          h3: ({ children }) => (
            <h4 className="text-[13px] font-semibold text-ink">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-[15px] leading-relaxed text-ink-soft">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="text-ink-soft italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} className="font-medium text-accent hover:underline">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="flex flex-col gap-2">{children}</ul>,
          ol: ({ children }) => (
            <ol className="flex list-decimal flex-col gap-2 pl-5 marker:text-ink-mute">
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => {
            const ordered = "ordered" in props && Boolean(props.ordered);
            if (ordered) {
              return <li className="text-[15px] leading-relaxed text-ink-soft">{children}</li>;
            }
            return (
              <li className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
                <span
                  aria-hidden
                  className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-accent"
                />
                <span className="min-w-0 flex-1">{children}</span>
              </li>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="rounded-md border border-line bg-danger-soft px-4 py-3 text-[15px] leading-relaxed text-ink">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-line" />,
          code: ({ children }) => (
            <code className="rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-[13px] text-ink">
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full border-collapse text-left text-[14px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-sunken">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-line last:border-b-0">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 text-[12px] font-semibold whitespace-nowrap text-ink-soft">
              {children}
            </th>
          ),
          td: ({ children }) => <ReportCell>{children}</ReportCell>,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}

/**
 * Table cells carry the colour coding. A cell whose whole content is a known
 * flag word becomes a badge; a cell that is purely a measurement is set in the
 * mono face so columns of numbers line up.
 */
function ReportCell({ children }: ComponentPropsWithoutRef<"td">) {
  const text = plainText(children).trim();
  const tone = toneFor(text);

  if (tone) {
    return (
      <td className="px-3.5 py-2.5 align-top">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
            TONE_CLASS[tone],
          )}
        >
          {text}
        </span>
      </td>
    );
  }

  const numeric = /^[\d.,]+\s*[^\s]{0,12}$|^[\d.,]+\s*[-to]+\s*[\d.,]+/i.test(text);

  return (
    <td
      className={cn(
        "px-3.5 py-2.5 align-top text-ink",
        numeric ? "font-mono whitespace-nowrap tabular-nums" : "text-ink-soft",
      )}
    >
      {Children.count(children) > 0 ? children : "-"}
    </td>
  );
}

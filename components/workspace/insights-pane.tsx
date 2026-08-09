"use client";

import { ArrowClockwise, Check, Copy, DownloadSimple, FileText, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { useReportLanguage } from "@/hooks/use-report-language";
import { languageLabel } from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { WorkspacePhase } from "@/types/workspace";

import { LanguageSelect } from "./language-select";
import { PaneHeader } from "./pane-header";
import { ReportMarkdown } from "./report-markdown";
import { ReportSkeleton } from "./report-skeleton";

export function InsightsPane({
  phase,
  report,
  documentName,
  message,
  onRetry,
}: {
  phase: WorkspacePhase;
  report: string;
  documentName: string | null;
  message: string | null;
  onRetry: () => void;
}) {
  const { language, markdown, translating, error, setLanguage } = useReportLanguage(
    phase === "ready" ? report : "",
  );

  // While the report is still streaming it is shown as written, untranslated.
  const body = phase === "ready" ? markdown : report;
  const hasBody = body.trim().length > 0;

  return (
    <section aria-label="Insights" className="flex h-full min-h-0 flex-col bg-surface">
      <PaneHeader
        title="Insights"
        meta={documentName ?? "Waiting for a document"}
        actions={
          <>
            <LanguageSelect
              value={language}
              onChange={setLanguage}
              disabled={phase !== "ready" || translating}
            />
            <ReportActions markdown={body} documentName={documentName} disabled={!hasBody} />
          </>
        }
      />

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {translating ? (
          <div
            aria-live="polite"
            className="glass-nav sticky top-0 z-10 flex items-center gap-2 border-b border-line px-4 py-2 text-[13px] text-ink-soft sm:px-6"
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-accent motion-safe:animate-pulse"
            />
            Translating into {languageLabel(language)}
          </div>
        ) : null}

        <div className={cn("px-4 py-6 sm:px-6", translating && "opacity-60 transition-opacity duration-200")}>
          {phase === "idle" ? (
            <EmptyState />
          ) : phase === "error" ? (
            <ErrorState message={message} onRetry={onRetry} />
          ) : hasBody ? (
            <>
              <ReportMarkdown markdown={body} />
              {phase === "composing" ? (
                <span
                  aria-hidden
                  className="mt-3 inline-block h-4 w-[2px] bg-accent motion-safe:animate-pulse"
                />
              ) : null}
              {phase === "ready" ? (
                <p className="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-ink-mute">
                  Read from your document by Sarvam. Educational only, and not a diagnosis. Check
                  anything that matters with your clinician.
                </p>
              ) : null}
            </>
          ) : (
            <ReportSkeleton
              label={phase === "composing" ? "Writing the report" : "Reading the document"}
            />
          )}

          {error ? (
            <p className="mt-4 rounded-md border border-line bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-full border border-line bg-sunken text-ink-mute"
      >
        <FileText size={20} />
      </span>
      <p className="text-[15px] font-medium text-ink">No document yet</p>
      <p className="max-w-xs text-[13px] leading-relaxed text-ink-soft">
        Add a report, scan or prescription on the left. The reading appears here as it is written.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-danger-soft px-4 py-4">
      <WarningCircle size={18} className="mt-0.5 shrink-0 text-danger" />
      <div className="flex-1">
        <p className="text-[14px] text-ink">{message ?? "That document could not be read."}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
        >
          <ArrowClockwise size={14} />
          Try again
        </button>
      </div>
    </div>
  );
}

function ReportActions({
  markdown,
  documentName,
  disabled,
}: {
  markdown: string;
  documentName: string | null;
  disabled: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const base = (documentName ?? "report").replace(/\.[^.]+$/, "");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${base}-reading.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const buttonClass =
    "flex size-8 items-center justify-center rounded-full text-ink-mute transition-colors duration-150 hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-45";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(markdown).then(() => setCopied(true));
        }}
        disabled={disabled}
        aria-label={copied ? "Report copied" : "Copy report"}
        title={copied ? "Copied" : "Copy report"}
        className={buttonClass}
      >
        {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
      </button>
      <button
        type="button"
        onClick={download}
        disabled={disabled}
        aria-label="Download report as Markdown"
        title="Download report"
        className={buttonClass}
      >
        <DownloadSimple size={16} />
      </button>
    </>
  );
}

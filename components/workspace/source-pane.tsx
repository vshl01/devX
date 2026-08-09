"use client";

import { ArrowClockwise, FilePdf, Image as ImageIcon, Trash, WarningCircle } from "@phosphor-icons/react";

import { documentTypeLabel, formatBytes } from "@/lib/documents";
import { cn } from "@/lib/utils";
import type { SourceDocument, WorkspacePhase } from "@/types/workspace";

import { DocumentDropzone } from "./document-dropzone";
import { PaneHeader } from "./pane-header";

const STAGES: Array<{ id: WorkspacePhase; label: string }> = [
  { id: "uploading", label: "Uploading" },
  { id: "extracting", label: "Reading the page" },
  { id: "composing", label: "Writing the report" },
];

function stageIndex(phase: WorkspacePhase): number {
  const index = STAGES.findIndex((stage) => stage.id === phase);
  if (index >= 0) return index;
  return phase === "ready" ? STAGES.length : -1;
}

export function SourcePane({
  document,
  phase,
  progress,
  pageCount,
  message,
  onSelect,
  onRemove,
  onRetry,
}: {
  document: SourceDocument | null;
  phase: WorkspacePhase;
  progress: number;
  pageCount: number;
  message: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const active = stageIndex(phase);
  const busy = phase === "uploading" || phase === "extracting" || phase === "composing";

  return (
    <section aria-label="Document" className="flex h-full min-h-0 flex-col bg-canvas">
      <PaneHeader
        title="Document"
        meta={
          document
            ? `${documentTypeLabel(document.contentType)} · ${formatBytes(document.sizeBytes)}${
                pageCount > 0 ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""
              }`
            : "Nothing loaded"
        }
        actions={
          document ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove document"
              className="flex size-8 items-center justify-center rounded-full text-ink-mute transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              <Trash size={16} />
            </button>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {!document ? (
          <DocumentDropzone onSelect={onSelect} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent"
              >
                {document.kind === "pdf" ? <FilePdf size={18} /> : <ImageIcon size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {document.name}
                </span>
                <span className="block text-xs text-ink-mute">
                  {documentTypeLabel(document.contentType)} · {formatBytes(document.sizeBytes)}
                </span>
              </span>
            </div>

            {phase === "error" ? (
              <div className="flex items-start gap-3 rounded-md border border-line bg-danger-soft px-3 py-3">
                <WarningCircle size={17} className="mt-0.5 shrink-0 text-danger" />
                <div className="flex-1">
                  <p className="text-[13px] text-ink">{message}</p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
                  >
                    <ArrowClockwise size={14} />
                    Try again
                  </button>
                </div>
              </div>
            ) : busy ? (
              <ol className="flex flex-col gap-2.5" aria-live="polite">
                {STAGES.map((stage, index) => {
                  const done = index < active;
                  const running = index === active;
                  return (
                    <li key={stage.id} className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full transition-colors duration-200",
                          done || running ? "bg-accent" : "bg-line-strong",
                        )}
                      />
                      <span
                        className={cn(
                          "text-[13px] transition-colors duration-200",
                          running ? "font-medium text-ink" : done ? "text-ink-soft" : "text-ink-mute",
                        )}
                      >
                        {stage.label}
                      </span>
                      {running && stage.id === "uploading" ? (
                        <span className="ml-auto font-mono text-xs text-ink-mute tabular-nums">
                          {Math.round(progress * 100)}%
                        </span>
                      ) : null}
                      {running && stage.id !== "uploading" ? (
                        <span className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-line-strong">
                          <span className="block h-full w-1/3 rounded-full bg-accent motion-safe:animate-[slide_1.4s_ease-in-out_infinite]" />
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : null}

            <DocumentPreview document={document} />

            <DocumentDropzone onSelect={onSelect} compact />
          </div>
        )}
      </div>
    </section>
  );
}

/** Native preview: the browser renders PDFs, images render directly. */
function DocumentPreview({ document }: { document: SourceDocument }) {
  if (document.kind === "image") {
    return (
      <figure className="overflow-hidden rounded-lg border border-line bg-sunken">
        {/* Local object URL, so next/image optimisation does not apply. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={document.previewUrl}
          alt={`Preview of ${document.name}`}
          className="max-h-[60vh] w-full object-contain"
        />
      </figure>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-sunken">
      <object
        data={document.previewUrl}
        type="application/pdf"
        aria-label={`Preview of ${document.name}`}
        className="h-[58vh] w-full"
      >
        <p className="p-4 text-[13px] text-ink-soft">
          This browser cannot preview PDFs inline.{" "}
          <a
            href={document.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Open the file
          </a>
          .
        </p>
      </object>
    </div>
  );
}

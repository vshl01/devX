"use client";

import { ArrowsOut, FilePdf, SpinnerGap } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { statusLabel } from "@/lib/prescriptions/display";
import type { PrescriptionStatus } from "@/types/prescription";
import { cn } from "@/lib/utils";

export function PrescriptionViewer({
  previewUrl,
  fileName,
  mimeType,
  status,
  onReplace,
  processing,
}: {
  previewUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  status?: PrescriptionStatus | null;
  onReplace: () => void;
  processing?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);
  const isPdf =
    mimeType === "application/pdf" || (fileName ? /\.pdf$/i.test(fileName) : false);

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-ink-mute uppercase">
            Original prescription
          </p>
          <p className="truncate text-sm font-medium text-ink">{fileName ?? "Prescription"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs text-ink-soft">
              {processing ? <SpinnerGap size={12} className="animate-spin" aria-hidden /> : null}
              {statusLabel(status)}
            </span>
          ) : null}
          <Button type="button" variant="quiet" size="sm" onClick={onReplace}>
            Replace
          </Button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-sunken/40 p-3">
        {!previewUrl ? (
          <p className="text-sm text-ink-mute">No preview available.</p>
        ) : isPdf ? (
          <iframe
            title="Prescription PDF"
            src={previewUrl}
            className="h-full min-h-[360px] w-full rounded-lg bg-surface"
          />
        ) : (
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            className="group relative max-h-full max-w-full"
            aria-label={zoomed ? "Zoom out" : "Zoom in"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded prescription"
              className={cn(
                "max-h-[520px] rounded-lg object-contain shadow-md transition-transform duration-200 ease-out-soft",
                zoomed ? "scale-125 cursor-zoom-out" : "cursor-zoom-in",
              )}
            />
            <span className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-full bg-surface/90 text-ink-soft opacity-0 shadow-sm ring-1 ring-line transition-opacity group-hover:opacity-100">
              <ArrowsOut size={14} aria-hidden />
            </span>
          </button>
        )}

        {isPdf && previewUrl ? (
          <span className="pointer-events-none absolute top-5 left-5 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-xs text-ink-soft shadow-sm ring-1 ring-line">
            <FilePdf size={14} aria-hidden /> PDF
          </span>
        ) : null}
      </div>
    </div>
  );
}

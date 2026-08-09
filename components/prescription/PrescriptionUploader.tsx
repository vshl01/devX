"use client";

import { FilePdf, Image as ImageIcon, SpinnerGap, UploadSimple } from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf";

/** Bundled demo Rx — judges can try without downloading a file. */
export const SAMPLE_PRESCRIPTION_PATH = "/samples/sample-prescription.png";
const SAMPLE_PRESCRIPTION_NAME = "sample-prescription.png";

export function PrescriptionUploader({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const acceptFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      const ok =
        /image\/(jpeg|png)/.test(file.type) ||
        file.type === "application/pdf" ||
        /\.(jpe?g|png|pdf)$/i.test(file.name);
      if (!ok) {
        setLocalError("Please upload a JPG, PNG, or PDF.");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setLocalError("File must be under 50 MB.");
        return;
      }
      setLocalError(null);
      onFile(file);
    },
    [onFile],
  );

  const useSample = useCallback(async () => {
    if (disabled || loadingSample) return;
    setLoadingSample(true);
    setLocalError(null);
    try {
      const response = await fetch(SAMPLE_PRESCRIPTION_PATH);
      if (!response.ok) throw new Error("Sample not found");
      const blob = await response.blob();
      const file = new File([blob], SAMPLE_PRESCRIPTION_NAME, {
        type: blob.type || "image/png",
      });
      acceptFile(file);
    } catch {
      setLocalError("Couldn't load the sample prescription. Please try again.");
    } finally {
      setLoadingSample(false);
    }
  }, [acceptFile, disabled, loadingSample]);

  const busy = disabled || loadingSample;

  return (
    <div className="flex min-h-[420px] flex-col gap-4">
      {/* Demo sample — one click for judges / testers */}
      <button
        type="button"
        disabled={busy}
        onClick={() => void useSample()}
        className={cn(
          "group flex w-full items-stretch overflow-hidden rounded-xl border border-line bg-surface text-left shadow-sm transition-[border-color,box-shadow] duration-200 ease-out-soft",
          "hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          busy && "pointer-events-none opacity-70",
        )}
      >
        <span className="relative w-[7.5rem] shrink-0 self-stretch overflow-hidden bg-sunken sm:w-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SAMPLE_PRESCRIPTION_PATH}
            alt="Sample handwritten dental prescription"
            className="absolute inset-0 size-full object-cover object-top transition-transform duration-300 ease-out-soft group-hover:scale-[1.03]"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3.5 sm:px-5 sm:py-4">
          <span className="text-[11px] font-medium tracking-wide text-accent uppercase">
            Try without uploading
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            Use sample prescription
          </span>
          <span className="text-sm leading-snug text-ink-soft">
            Handwritten dental Rx (Augmentin, Enzoflam, Pan-D) — one click to process.
          </span>
          <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
            {loadingSample ? (
              <>
                <SpinnerGap size={14} className="animate-spin" aria-hidden />
                Loading sample…
              </>
            ) : (
              "Select sample →"
            )}
          </span>
        </span>
      </button>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (busy) return;
          acceptFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-sunken/60 px-6 py-10 text-center transition-[border-color,background-color] duration-200 ease-out-soft",
          dragging ? "border-accent bg-accent-soft/50" : "border-line-strong",
          busy && "opacity-70",
        )}
      >
        <span
          aria-hidden
          className="mb-5 flex size-14 items-center justify-center rounded-lg bg-surface text-accent shadow-sm ring-1 ring-line"
        >
          {busy ? (
            <SpinnerGap size={28} className="animate-spin" />
          ) : (
            <UploadSimple size={28} weight="duotone" />
          )}
        </span>
        <h3 className="text-lg font-semibold tracking-tight text-ink">Upload prescription</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          Or drop your own clear photo or PDF of a doctor&apos;s handwritten prescription.
        </p>
        <div className="mt-4 flex items-center gap-3 text-xs text-ink-mute">
          <span className="inline-flex items-center gap-1">
            <ImageIcon size={14} aria-hidden /> JPG / PNG
          </span>
          <span className="inline-flex items-center gap-1">
            <FilePdf size={14} aria-hidden /> PDF
          </span>
        </div>
        <Button
          type="button"
          className="mt-6"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
        {localError ? <p className="mt-4 text-sm text-danger">{localError}</p> : null}
      </div>
    </div>
  );
}

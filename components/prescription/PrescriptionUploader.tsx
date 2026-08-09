"use client";

import { FilePdf, Image as ImageIcon, SpinnerGap, UploadSimple } from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf";

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

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        acceptFile(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed bg-sunken/60 px-6 py-12 text-center transition-[border-color,background-color] duration-200 ease-out-soft",
        dragging ? "border-accent bg-accent-soft/50" : "border-line-strong",
        disabled && "opacity-70",
      )}
    >
      <span
        aria-hidden
        className="mb-5 flex size-14 items-center justify-center rounded-lg bg-surface text-accent shadow-sm ring-1 ring-line"
      >
        {disabled ? (
          <SpinnerGap size={28} className="animate-spin" />
        ) : (
          <UploadSimple size={28} weight="duotone" />
        )}
      </span>
      <h3 className="text-lg font-semibold tracking-tight text-ink">Upload prescription</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        Upload a clear photo or PDF of your doctor&apos;s handwritten prescription.
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
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Choose file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />
      {localError ? <p className="mt-4 text-sm text-danger">{localError}</p> : null}
    </div>
  );
}

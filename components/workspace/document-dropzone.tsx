"use client";

import { FilePlus, UploadSimple } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { DOCUMENT_ACCEPT_ATTRIBUTE } from "@/lib/documents";
import { cn } from "@/lib/utils";

/** Idle state of the source pane: drag a file in, or browse for one. */
export function DocumentDropzone({
  onSelect,
  compact = false,
}: {
  onSelect: (file: File) => void;
  compact?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  return (
    <div
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onSelect(file);
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed text-center transition-[border-color,background-color] duration-200 ease-out-soft",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-14",
        dragging ? "border-accent-line bg-accent-soft" : "border-line-strong bg-sunken",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={DOCUMENT_ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
          event.target.value = "";
        }}
      />

      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-full border border-line bg-surface text-accent",
          compact ? "size-9" : "size-12",
        )}
      >
        {dragging ? <FilePlus size={compact ? 18 : 22} /> : <UploadSimple size={compact ? 18 : 22} />}
      </span>

      {compact ? null : (
        <p className="text-[15px] font-medium text-ink">
          Drop a report, prescription or scan here
        </p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-full text-[13px] font-medium text-accent underline-offset-4 hover:underline"
      >
        {compact ? "Replace document" : "Or browse your files"}
      </button>

      {compact ? null : (
        <p className="text-xs text-ink-mute">
          PDF, JPG, PNG or HEIC, up to 20 MB. Handwritten prescriptions are read too.
        </p>
      )}
    </div>
  );
}

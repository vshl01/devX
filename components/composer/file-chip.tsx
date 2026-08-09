"use client";

import { FileArrowUp, FilePdf, Image as ImageIcon, WarningCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { formatBytes } from "@/lib/files";
import { transition } from "@/lib/motion";
import type { UploadState } from "@/types/composer";

/** The attached report, with its upload and reading progress. */
export function FileChip({
  upload,
  onRemove,
}: {
  upload: UploadState;
  onRemove: () => void;
}) {
  const reduced = useReducedMotion();
  if (upload.status === "idle") return null;

  const isError = upload.status === "error";
  const name = upload.status === "ready" ? upload.report.name : upload.name;
  const size =
    upload.status === "ready"
      ? upload.report.sizeBytes
      : upload.status === "error"
        ? null
        : upload.sizeBytes;

  const progress = upload.status === "uploading" ? upload.progress : 1;

  const kind = upload.status === "ready" ? upload.report.kind : null;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key="chip"
        initial={reduced ? false : { opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -4 }}
        transition={transition.base}
        className="flex items-center gap-3 rounded-md border border-line bg-sunken px-3 py-2"
      >
        <span
          aria-hidden
          className={
            isError
              ? "flex size-8 shrink-0 items-center justify-center rounded-sm bg-danger-soft text-danger"
              : "flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent"
          }
        >
          {isError ? (
            <WarningCircle size={17} />
          ) : kind === "image" ? (
            <ImageIcon size={17} />
          ) : kind === "pdf" ? (
            <FilePdf size={17} />
          ) : (
            <FileArrowUp size={17} />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{name}</span>

          {isError ? (
            <span className="block text-xs text-danger">{upload.message}</span>
          ) : upload.status === "ready" ? (
            <span className="block text-xs text-ink-mute">
              {size !== null ? `${formatBytes(size)} ` : ""}
              {upload.report.needsVision ? "ready to read" : "text read"}
            </span>
          ) : (
            <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-line-strong">
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-200 ease-out-soft"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
              <span className="sr-only">
                {upload.status === "reading"
                  ? "Reading the report"
                  : `Uploading, ${Math.round(progress * 100)} percent`}
              </span>
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-mute transition-colors duration-150 hover:bg-line hover:text-ink"
        >
          <X size={14} weight="bold" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

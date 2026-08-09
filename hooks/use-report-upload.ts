"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { validateReport } from "@/lib/files";
import type { ReportIntakeResponse, UploadState } from "@/types/composer";

export interface UseReportUpload {
  upload: UploadState;
  /** Kept so an image report can be read by the vision model on submit. */
  fileRef: React.RefObject<File | null>;
  select: (file: File) => void;
  clear: () => void;
}

/**
 * Uploads one report to `/api/reports`. Uses XHR rather than fetch because it
 * is the only way to get real upload progress in the browser.
 */
export function useReportUpload(): UseReportUpload {
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const requestRef = useRef<XMLHttpRequest | null>(null);
  const fileRef = useRef<File | null>(null);

  const clear = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    fileRef.current = null;
    setUpload({ status: "idle" });
  }, []);

  const select = useCallback((file: File) => {
    requestRef.current?.abort();

    const check = validateReport(file);
    if (!check.ok) {
      fileRef.current = null;
      setUpload({ status: "error", name: file.name, message: check.message });
      return;
    }

    fileRef.current = file;
    setUpload({ status: "uploading", name: file.name, sizeBytes: file.size, progress: 0 });

    const form = new FormData();
    form.append("report", file);

    const request = new XMLHttpRequest();
    requestRef.current = request;
    request.open("POST", "/api/reports");
    request.responseType = "json";

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const progress = event.loaded / event.total;
      setUpload(
        progress >= 1
          ? { status: "reading", name: file.name, sizeBytes: file.size }
          : { status: "uploading", name: file.name, sizeBytes: file.size, progress },
      );
    });

    request.addEventListener("load", () => {
      requestRef.current = null;
      const payload = request.response as ReportIntakeResponse & { error?: string };

      if (request.status >= 400 || !payload) {
        fileRef.current = null;
        setUpload({
          status: "error",
          name: file.name,
          message: payload?.error ?? "That file could not be read.",
        });
        return;
      }

      setUpload({ status: "ready", report: payload });
    });

    request.addEventListener("error", () => {
      requestRef.current = null;
      fileRef.current = null;
      setUpload({ status: "error", name: file.name, message: "The upload failed. Try again." });
    });

    request.addEventListener("abort", () => {
      requestRef.current = null;
    });

    request.send(form);
  }, []);

  useEffect(() => () => requestRef.current?.abort(), []);

  return { upload, fileRef, select, clear };
}

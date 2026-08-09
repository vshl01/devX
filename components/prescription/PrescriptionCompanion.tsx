"use client";

import { Pulse } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AskPrescription } from "@/components/prescription/AskPrescription";
import { LanguageSelector } from "@/components/prescription/LanguageSelector";
import { PrescriptionDetails } from "@/components/prescription/PrescriptionDetails";
import { PrescriptionPresentation } from "@/components/prescription/PrescriptionPresentation";
import { PrescriptionUploader } from "@/components/prescription/PrescriptionUploader";
import { PrescriptionViewer } from "@/components/prescription/PrescriptionViewer";
import { ProcessingState, SafetyNote } from "@/components/prescription/ProcessingState";
import { Container } from "@/components/ui/container";
import {
  getPrescription,
  PrescriptionApiError,
  prescriptionFileUrl,
  translatePrescription,
  uploadPrescription,
} from "@/lib/prescriptions/api-client";
import { statusLabel } from "@/lib/prescriptions/display";
import type {
  PrescriptionRecord,
  PrescriptionStatus,
  TranslatedPresentation,
} from "@/types/prescription";
import { isTranslatedPresentation, TERMINAL_STATUSES } from "@/types/prescription";
import { cn } from "@/lib/utils";

type ViewMode = "original" | "translated";

export function PrescriptionCompanion() {
  const [file, setFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [record, setRecord] = useState<PrescriptionRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [language, setLanguage] = useState("en-IN");
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const [translatedData, setTranslatedData] = useState<TranslatedPresentation | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const translationCache = useRef<Map<string, TranslatedPresentation>>(new Map());
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revokePreview = useCallback(() => {
    setLocalPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const resetAll = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    revokePreview();
    setFile(null);
    setPrescriptionId(null);
    setRecord(null);
    setUploading(false);
    setError(null);
    setViewMode("original");
    setTranslatedData(null);
    setTranslateError(null);
    translationCache.current.clear();
  }, [revokePreview]);

  const handleFile = useCallback(
    async (next: File) => {
      resetAll();
      setFile(next);
      setLocalPreviewUrl(URL.createObjectURL(next));
      setUploading(true);
      setError(null);

      try {
        const result = await uploadPrescription(next);
        setPrescriptionId(result.prescriptionId);
        setRecord({
          id: result.prescriptionId,
          status: "PROCESSING",
          originalFileName: next.name,
          originalMimeType: next.type,
          fileUrl: prescriptionFileUrl(result.prescriptionId),
          originalLanguage: null,
          rawText: null,
          prescription: null,
          targetLanguage: null,
          translations: [],
          error: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (cause) {
        const message =
          cause instanceof PrescriptionApiError
            ? cause.message
            : "We couldn't upload this prescription. Please try again.";
        setError(message);
        setUploading(false);
      }
    },
    [resetAll],
  );

  // Poll until terminal status
  useEffect(() => {
    if (!prescriptionId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getPrescription(prescriptionId);
        if (cancelled) return;
        setRecord(data);
        setUploading(false);

        if (TERMINAL_STATUSES.includes(data.status)) {
          if (data.status === "FAILED") {
            setError(
              data.error?.message ||
                "We couldn't process this prescription. Please try again or upload a clearer image.",
            );
          }
          // Seed translation cache from existing full-document presentations only.
          for (const t of data.translations ?? []) {
            if (isTranslatedPresentation(t.translatedData)) {
              translationCache.current.set(t.targetLanguage, t.translatedData);
            }
          }
          return;
        }

        pollRef.current = setTimeout(() => {
          void poll();
        }, 1800);
      } catch (cause) {
        if (cancelled) return;
        setUploading(false);
        setError(
          cause instanceof PrescriptionApiError
            ? cause.message
            : "We lost connection while processing. Please refresh and try again.",
        );
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [prescriptionId]);

  const ready =
    record &&
    (record.status === "COMPLETED" || record.status === "PARTIALLY_COMPLETED") &&
    record.prescription;

  const processing =
    Boolean(prescriptionId) &&
    !ready &&
    record?.status !== "FAILED" &&
    !error;

  const previewUrl =
    localPreviewUrl ||
    (prescriptionId ? prescriptionFileUrl(prescriptionId) : null);

  const handleLanguageChange = useCallback(
    async (code: string) => {
      setLanguage(code);
      setTranslateError(null);

      if (code === "en-IN") {
        setViewMode("original");
        setTranslatedData(null);
        return;
      }

      if (!prescriptionId || !ready) {
        return;
      }

      const cached = translationCache.current.get(code);
      if (cached) {
        setTranslatedData(cached);
        setViewMode("translated");
        return;
      }

      setTranslating(true);
      try {
        // Always from canonical on the server — never from a prior translation.
        const result = await translatePrescription(prescriptionId, code);
        translationCache.current.set(code, result.translatedData);
        setTranslatedData(result.translatedData);
        setViewMode("translated");
      } catch (cause) {
        setTranslateError(
          cause instanceof PrescriptionApiError
            ? cause.message
            : "Translation failed. Showing the original extraction.",
        );
        setViewMode("original");
      } finally {
        setTranslating(false);
      }
    },
    [prescriptionId, ready],
  );

  const languageLabel =
    language === "en-IN"
      ? "English"
      : language === "hi-IN"
        ? "हिन्दी"
        : language === "kn-IN"
          ? "ಕನ್ನಡ"
          : language === "ta-IN"
            ? "தமிழ்"
            : language === "te-IN"
              ? "తెలుగు"
              : language === "ml-IN"
                ? "മലയാളം"
                : language;

  return (
    <div className="min-h-full bg-canvas">
      <header className="border-b border-line bg-surface/80 backdrop-blur-md">
        <Container className="flex h-14 items-center justify-between gap-4">
          <Link href="/prescription" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-md bg-accent text-on-accent"
            >
              <Pulse size={18} weight="bold" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-ink">
              Doctor AI Front Desk
            </span>
          </Link>
          <div className="hidden max-w-md md:block">
            <SafetyNote />
          </div>
        </Container>
      </header>

      <main className="pb-10">
        <Container className="pt-8 sm:pt-10">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
                Prescription Companion
              </h1>
              <p className="mt-1.5 text-sm text-ink-soft sm:text-[15px]">
                Understand your doctor&apos;s prescription — clearly, in your language.
              </p>
            </div>
            <LanguageSelector
              value={language}
              onChange={(code) => void handleLanguageChange(code)}
              disabled={!ready || translating}
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              {error}
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <section aria-label="Original prescription">
              {!file && !prescriptionId ? (
                <PrescriptionUploader onFile={(f) => void handleFile(f)} disabled={uploading} />
              ) : (
                <PrescriptionViewer
                  previewUrl={previewUrl}
                  fileName={file?.name ?? record?.originalFileName ?? null}
                  mimeType={file?.type ?? record?.originalMimeType ?? null}
                  status={(record?.status as PrescriptionStatus) ?? (uploading ? "UPLOADING" : null)}
                  processing={processing || uploading}
                  onReplace={resetAll}
                />
              )}
            </section>

            <section
              aria-label="AI understanding"
              className="flex min-h-[420px] flex-col rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-ink-mute uppercase">
                    AI understanding
                  </p>
                  <p className="text-sm text-ink-soft">
                    {processing
                      ? statusLabel(record?.status ?? "PROCESSING")
                      : ready
                        ? "Structured from your prescription"
                        : "Waiting for upload"}
                  </p>
                </div>

                {ready ? (
                  <div
                    role="tablist"
                    aria-label="Original or translated"
                    className="inline-flex rounded-full border border-line bg-sunken p-0.5"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === "original"}
                      onClick={() => setViewMode("original")}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                        viewMode === "original"
                          ? "bg-surface text-ink shadow-sm"
                          : "text-ink-soft hover:text-ink",
                      )}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === "translated"}
                      disabled={language === "en-IN" || !translatedData}
                      onClick={() => {
                        if (translatedData) setViewMode("translated");
                        else void handleLanguageChange(language);
                      }}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 disabled:opacity-40",
                        viewMode === "translated"
                          ? "bg-surface text-ink shadow-sm"
                          : "text-ink-soft hover:text-ink",
                      )}
                    >
                      {languageLabel}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                {processing || uploading ? (
                  <ProcessingState message={statusLabel(record?.status ?? "PROCESSING")} />
                ) : viewMode === "translated" ? (
                  <PrescriptionPresentation
                    data={translatedData}
                    translating={translating}
                    emptyMessage={
                      translateError ||
                      "Choose a language to see the full translated prescription."
                    }
                  />
                ) : (
                  <PrescriptionDetails
                    data={ready ? record?.prescription ?? null : null}
                    translating={translating}
                    emptyMessage={
                      translateError ||
                      "Upload a prescription to see the structured understanding here."
                    }
                  />
                )}
              </div>

              {translateError ? (
                <p className="mt-3 text-xs text-danger">{translateError}</p>
              ) : null}
            </section>
          </div>

          <div className="mt-5 sm:mt-6">
            <AskPrescription
              prescriptionId={ready ? prescriptionId : null}
              data={ready ? record?.prescription ?? null : null}
              disabled={!ready}
            />
          </div>

          <div className="mt-6 md:hidden">
            <SafetyNote />
          </div>
        </Container>
      </main>
    </div>
  );
}

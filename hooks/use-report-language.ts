"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TranslatableLanguage } from "@/lib/languages";

const SOURCE: TranslatableLanguage = "en-IN";

type Cache = Partial<Record<TranslatableLanguage, string>>;

interface CacheEntry {
  /** The report these translations belong to. */
  source: string;
  byLanguage: Cache;
}

const EMPTY: CacheEntry = { source: "", byLanguage: {} };

export interface UseReportLanguage {
  language: TranslatableLanguage;
  /** The report in the selected language, or the source while one loads. */
  markdown: string;
  translating: boolean;
  error: string | null;
  setLanguage: (next: TranslatableLanguage) => void;
}

/**
 * Keeps the insights pane in the reader's language. Translations are cached per
 * language for the life of a report, so switching back is instant, and the pane
 * keeps showing the previous language while a new one loads.
 */
export function useReportLanguage(
  report: string,
  sessionId: string | null = null,
): UseReportLanguage {
  const [language, setLanguage] = useState<TranslatableLanguage>(SOURCE);
  const [entry, setEntry] = useState<CacheEntry>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Translations belong to one exact report; a new one starts from scratch.
  const cache = entry.source === report ? entry.byLanguage : EMPTY.byLanguage;
  const cached = language === SOURCE ? report : cache[language];
  // Derived rather than stored: a missing translation with no error is a load.
  const translating = cached === undefined && error === null && report.trim().length > 0;

  useEffect(() => {
    if (language === SOURCE || !report.trim() || cached !== undefined) return;

    const controller = new AbortController();
    abortRef.current = controller;

    void (async () => {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ markdown: report, target: language, source: SOURCE, sessionId }),
        });

        const payload = (await response.json()) as { markdown?: string; error?: string };
        if (!response.ok || !payload.markdown) {
          setError(payload.error ?? "The translation failed.");
          return;
        }

        setEntry((current) =>
          current.source === report
            ? { source: report, byLanguage: { ...current.byLanguage, [language]: payload.markdown } }
            : { source: report, byLanguage: { [language]: payload.markdown } },
        );
        setError(null);
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        setError("Lost connection while translating.");
      }
    })();

    return () => controller.abort();
  }, [cached, language, report, sessionId]);

  const choose = useCallback((next: TranslatableLanguage) => {
    abortRef.current?.abort();
    setError(null);
    setLanguage(next);
  }, []);

  return {
    language,
    markdown: cached ?? report,
    translating,
    error,
    setLanguage: choose,
  };
}

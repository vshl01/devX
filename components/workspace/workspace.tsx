"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { useDocumentWorkspace } from "@/hooks/use-document-workspace";
import { useSplitPane } from "@/hooks/use-split-pane";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

import { InsightsPane } from "./insights-pane";
import { SourcePane } from "./source-pane";

type MobileTab = "document" | "insights";

/**
 * Two-pane workspace. Panes scroll independently and reach the viewport edges;
 * the divider is draggable on desktop and the panes become tabs on small
 * screens, where a 50/50 split would leave neither side usable.
 */
export function Workspace() {
  const workspace = useDocumentWorkspace();
  const { percent, dragging, containerRef, handleProps } = useSplitPane();
  const [tab, setTab] = useState<MobileTab>("document");

  const hasReport = workspace.phase === "composing" || workspace.phase === "ready";

  const select = (file: File) => {
    workspace.select(file);
    setTab("insights");
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-canvas">
      <header className="glass-nav flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            aria-label="Back to the home page"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-mute transition-colors duration-150 hover:bg-sunken hover:text-ink"
          >
            <ArrowLeft size={17} />
          </Link>
          <Logo />
        </div>

        <nav aria-label="Pane" className="flex rounded-full border border-line bg-sunken p-0.5 md:hidden">
          {(["document", "insights"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium capitalize transition-colors duration-150",
                tab === id ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
              )}
            >
              {id}
              {id === "insights" && hasReport && tab !== "insights" ? (
                <span aria-hidden className="ml-1.5 inline-block size-1.5 rounded-full bg-accent" />
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      <div ref={containerRef} className="flex min-h-0 flex-1 md:flex-row">
        <div
          className={cn("min-h-0 min-w-0 flex-1 md:flex-none", tab === "document" ? "flex" : "hidden md:flex")}
          style={{ flexBasis: `${percent}%` }}
        >
          <div className="min-h-0 w-full">
            <SourcePane
              document={workspace.document}
              phase={workspace.phase}
              progress={workspace.progress}
              pageCount={workspace.pageCount}
              message={workspace.message}
              onSelect={select}
              onRemove={workspace.reset}
              onRetry={workspace.retry}
            />
          </div>
        </div>

        <div
          {...handleProps}
          className={cn(
            "group relative hidden w-px shrink-0 cursor-col-resize bg-line-strong transition-colors duration-150 md:block",
            "hover:bg-accent focus-visible:bg-accent",
            dragging && "bg-accent",
          )}
        >
          {/* Wider invisible hit area than the visible hairline. */}
          <span aria-hidden className="absolute inset-y-0 -left-2 w-5" />
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 border-t border-line md:border-t-0 md:border-l-0",
            tab === "insights" ? "flex" : "hidden md:flex",
          )}
        >
          <div className="min-h-0 w-full">
            <InsightsPane
              phase={workspace.phase}
              report={workspace.report}
              documentName={workspace.document?.name ?? null}
              message={workspace.message}
              onRetry={workspace.retry}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

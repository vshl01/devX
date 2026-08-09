"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { useDocumentWorkspace } from "@/hooks/use-document-workspace";
import { useSplitPane } from "@/hooks/use-split-pane";
import { useVoiceConversation } from "@/hooks/use-voice-conversation";
import { useWorkspaceSession } from "@/hooks/use-workspace-session";
import { Logo } from "@/components/ui/logo";
import type { TranslatableLanguage } from "@/lib/languages";
import { cn } from "@/lib/utils";

import { InsightsPane } from "./insights-pane";
import { LeftPane } from "./left-pane";

type MobileTab = "source" | "insights";

/**
 * Two-pane workspace. Panes scroll independently and reach the viewport edges;
 * the divider is draggable on desktop and the panes become tabs on small
 * screens, where a 50/50 split would leave neither side usable.
 */
export function Workspace() {
  const { sessionId, snapshot } = useWorkspaceSession();
  const workspace = useDocumentWorkspace({ sessionId, snapshot });
  const { percent, dragging, containerRef, handleProps } = useSplitPane();
  const [tab, setTab] = useState<MobileTab>("source");
  const [language, setLanguage] = useState<TranslatableLanguage>("en-IN");

  const conversation = useVoiceConversation({
    sessionId,
    language,
    ready: workspace.phase === "ready",
    initialMessages: snapshot?.messages ?? [],
  });

  const hasReport = workspace.phase === "composing" || workspace.phase === "ready";

  const select = (file: File) => {
    workspace.select(file);
    setTab("insights");
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
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
          {(
            [
              { id: "source" as const, label: "Document" },
              { id: "insights" as const, label: "Insights" },
            ]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
                tab === item.id ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
              )}
            >
              {item.label}
              {item.id === "insights" && hasReport && tab !== "insights" ? (
                <span aria-hidden className="ml-1.5 inline-block size-1.5 rounded-full bg-accent" />
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      <div ref={containerRef} className="flex min-h-0 flex-1 md:flex-row">
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 md:flex-none",
            tab === "source" ? "flex" : "hidden md:flex",
          )}
          style={{ flexBasis: `${percent}%` }}
        >
          <div className="min-h-0 w-full">
            <LeftPane
              document={workspace.document}
              phase={workspace.phase}
              progress={workspace.progress}
              pageCount={workspace.pageCount}
              message={workspace.message}
              onSelect={select}
              onRemove={workspace.reset}
              onRetry={workspace.retry}
              conversationReady={workspace.phase === "ready"}
              onActivateVoice={() => void conversation.activate()}
              conversation={{
                messages: conversation.messages,
                interim: conversation.interim,
                status: conversation.status,
                error: conversation.error,
                onDismissError: conversation.dismissError,
              }}
              voice={{
                status: conversation.status,
                micOn: conversation.micOn,
                blocked: conversation.blocked,
                speechAvailable: conversation.speechAvailable,
                levelRef: conversation.levelRef,
                onToggleMic: conversation.toggleMic,
                onInterrupt: conversation.interrupt,
                onSend: conversation.sendText,
                onHoldStart: conversation.holdStart,
                onHoldEnd: conversation.holdEnd,
                onUnblock: conversation.unblock,
              }}
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
            "min-h-0 min-w-0 flex-1 border-t border-line md:border-t-0",
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
              sessionId={sessionId}
              onLanguageChange={setLanguage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

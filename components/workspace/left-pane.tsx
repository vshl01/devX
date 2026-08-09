"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";

import { documentTypeLabel, formatBytes } from "@/lib/documents";
import { EASE_OUT_SOFT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ChatMessage, VoiceStatus } from "@/types/conversation";
import type { SourceDocument, WorkspacePhase } from "@/types/workspace";

import { ChatPane } from "./chat-pane";
import { FloatingMic } from "./floating-mic";
import { PaneHeader } from "./pane-header";
import { PaneSwitch, type LeftView } from "./pane-switch";
import { SourceBody } from "./source-pane";
import { VoiceBar, type VoiceBarProps } from "./voice-bar";

/**
 * The left half: the conversation and the source document, one visible at a
 * time. Both stay mounted so scroll position, the transcript and the preview
 * survive the switch; only opacity and a small offset animate.
 */
export function LeftPane({
  document,
  phase,
  progress,
  pageCount,
  message,
  onSelect,
  onRemove,
  onRetry,
  conversation,
  voice,
  conversationReady,
  onActivateVoice,
}: {
  document: SourceDocument | null;
  phase: WorkspacePhase;
  progress: number;
  pageCount: number;
  message: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onRetry: () => void;
  conversation: {
    messages: ChatMessage[];
    interim: string;
    status: VoiceStatus;
    error: string | null;
    onDismissError: () => void;
  };
  voice: VoiceBarProps;
  /** True once the report exists, so the agent has something to talk about. */
  conversationReady: boolean;
  onActivateVoice: () => void;
}) {
  // `null` means the reader has not chosen yet, so the pane can follow the
  // agent to Chat the first time it speaks.
  const [chosen, setChosen] = useState<LeftView | null>(null);
  const [seen, setSeen] = useState(0);
  const reduced = useReducedMotion();

  const count = conversation.messages.length;
  const view: LeftView = chosen ?? (count > 0 ? "chat" : "document");
  const chatVisible = view === "chat";
  const unseen = !chatVisible && count > seen;

  // Leaving Chat records how much had been read, so the badge marks only what
  // arrived afterwards.
  const choose = useCallback(
    (next: LeftView) => {
      setChosen(next);
      if (next === "document") setSeen(count);
    },
    [count],
  );

  return (
    <section aria-label="Document and conversation" className="flex h-full min-h-0 flex-col bg-canvas">
      <PaneHeader
        title="Source"
        meta={
          document
            ? `${document.name} · ${documentTypeLabel(document.contentType)} · ${formatBytes(document.sizeBytes)}`
            : "Nothing loaded"
        }
        actions={<PaneSwitch value={view} onChange={choose} badge={unseen} />}
      />

      <div className="relative min-h-0 flex-1">
        <Layer visible={chatVisible} reduced={reduced} from={-8}>
          <ChatPane
            messages={conversation.messages}
            interim={conversation.interim}
            status={conversation.status}
            error={conversation.error}
            onDismissError={conversation.onDismissError}
          />
        </Layer>

        <Layer visible={!chatVisible} reduced={reduced} from={8}>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <SourceBody
              document={document}
              phase={phase}
              progress={progress}
              pageCount={pageCount}
              message={message}
              onSelect={onSelect}
              onRemove={onRemove}
              onRetry={onRetry}
            />
          </div>
        </Layer>

        {conversationReady && !chatVisible ? (
          <FloatingMic
            status={voice.status}
            micOn={voice.micOn}
            levelRef={voice.levelRef}
            onActivate={() => {
              // Talking starts here, and the transcript follows it.
              onActivateVoice();
              choose("chat");
            }}
            onStop={voice.onToggleMic}
          />
        ) : null}
      </div>

      {chatVisible ? <VoiceBar {...voice} /> : null}
    </section>
  );
}

/** One crossfading layer. Hidden layers stay mounted but leave the a11y tree. */
function Layer({
  visible,
  reduced,
  from,
  children,
}: {
  visible: boolean;
  reduced: boolean | null;
  from: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      aria-hidden={!visible}
      inert={!visible}
      animate={{ opacity: visible ? 1 : 0, x: visible ? 0 : from }}
      initial={false}
      transition={reduced ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT_SOFT }}
      className={cn(
        "absolute inset-0 flex min-h-0 flex-col",
        visible ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      {children}
    </motion.div>
  );
}

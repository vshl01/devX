"use client";

import { ArrowUp, Paperclip } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useCoachReply } from "@/hooks/use-coach-reply";
import { useReportUpload } from "@/hooks/use-report-upload";
import { ACCEPT_ATTRIBUTE } from "@/lib/files";
import { transition } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { FileChip } from "./file-chip";
import { MicButton } from "./mic-button";
import { ReplyPanel } from "./reply-panel";

const PLACEHOLDER = "Ask about a result, or upload the report and say what worries you";

export function Composer() {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const reduced = useReducedMotion();

  const { upload, fileRef, select, clear } = useReportUpload();
  const { reply, ask, reset } = useCoachReply();

  const appendTranscript = useCallback((text: string) => {
    setValue((current) => (current ? `${current.replace(/\s+$/, "")} ${text}` : text));
  }, []);

  const onEmptyResult = useCallback(
    () => setNotice("No speech was picked up. Move closer to the mic, or type your question."),
    [],
  );

  const recorder = useAudioRecorder({ onTranscript: appendTranscript, onEmptyResult });

  /* Auto-size the field so the composer grows with the question. */
  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 200)}px`;
  }, [value]);

  const onMicToggle = useCallback(() => {
    setNotice(null);
    recorder.toggle();
  }, [recorder]);

  const report = upload.status === "ready" ? upload.report : null;
  const busy = reply.status === "streaming";
  const canSubmit = (value.trim().length > 0 || report !== null) && !busy;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    recorder.stop();
    setNotice(null);
    void ask({ question: value, report, file: fileRef.current });
  }, [ask, canSubmit, fileRef, recorder, report, value]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  /* Drag and drop across the whole composer surface. */
  const onDragEnter = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) select(file);
  };

  const status = recorder.error ?? notice;

  return (
    <div className="w-full">
      <div
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "glass relative rounded-lg border p-2.5 transition-[border-color,box-shadow] duration-200 ease-out-soft",
          dragging && "border-accent-line",
        )}
      >
        <AnimatePresence>
          {dragging ? (
            <motion.div
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={transition.fast}
              className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center rounded-md border border-dashed border-accent-line bg-accent-soft"
            >
              <span className="text-sm font-medium text-accent">Drop the report here</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {upload.status !== "idle" ? (
          <div className="mb-2.5">
            <FileChip upload={upload} onRemove={clear} />
          </div>
        ) : null}

        <label htmlFor={inputId} className="sr-only">
          Your question about the report
        </label>
        <textarea
          id={inputId}
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          className="block max-h-50 w-full resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-mute"
        />

        <div className="mt-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) select(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach a medical report, PDF or photo"
              title="Attach a report"
              className="flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              <Paperclip size={19} />
            </button>
            <span className="hidden text-xs text-ink-mute sm:inline">PDF or photo, up to 20 MB</span>
          </div>

          <div className="flex items-center gap-2">
            <MicButton
              state={recorder.state}
              levelRef={recorder.levelRef}
              onToggle={onMicToggle}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              aria-label="Send question"
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full transition-[background-color,opacity,transform] duration-150 ease-out-soft active:scale-[0.96]",
                canSubmit
                  ? "bg-accent text-on-accent hover:bg-accent-hover"
                  : "cursor-not-allowed bg-line text-ink-mute",
              )}
            >
              <ArrowUp size={19} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      <div aria-live="polite" className="min-h-6 px-1 pt-2 text-center">
        {status ? (
          <p className="text-[13px] text-danger">
            {status}
            {recorder.error ? (
              <button
                type="button"
                onClick={recorder.dismissError}
                className="ml-2 font-medium underline underline-offset-2"
              >
                Dismiss
              </button>
            ) : null}
          </p>
        ) : (
          <p className="text-[13px] text-ink-mute">
            Lucid explains results. It does not diagnose or prescribe.
          </p>
        )}
      </div>

      <ReplyPanel
        reply={reply}
        onRetry={submit}
        onDismiss={() => {
          reset();
          setValue("");
        }}
      />
    </div>
  );
}

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Sticky pane header. The glass here is the only decorative material in the
 * workspace, so it stays thin and only earns weight when content scrolls under.
 */
export function PaneHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass-nav sticky top-0 z-20 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 sm:px-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
        {meta ? <div className="min-w-0 truncate text-xs text-ink-mute">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

import { cn } from "@/lib/utils";

/** Placeholder shaped like the finished report, not a spinner. */
export function ReportSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-7" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>

      <Block widths={["38%"]} heading />
      <div className="flex flex-col gap-2.5">
        <Line width="100%" />
        <Line width="94%" />
        <Line width="72%" />
      </div>

      <Block widths={["30%"]} heading />
      <div className="flex flex-col gap-3">
        {["88%", "76%", "82%"].map((width) => (
          <div key={width} className="flex gap-3">
            <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-line-strong" />
            <Line width={width} />
          </div>
        ))}
      </div>

      <Block widths={["26%"]} heading />
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="flex gap-4 bg-sunken px-3.5 py-3">
          {["22%", "16%", "26%", "14%"].map((width) => (
            <Line key={width} width={width} tone="strong" />
          ))}
        </div>
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex gap-4 border-t border-line px-3.5 py-3.5">
            {["24%", "14%", "28%", "12%"].map((width) => (
              <Line key={width} width={width} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Block({ widths, heading }: { widths: string[]; heading?: boolean }) {
  return (
    <div className={cn("flex gap-3", heading && "border-b border-line pb-2.5")}>
      {widths.map((width) => (
        <Line key={width} width={width} tone="strong" />
      ))}
    </div>
  );
}

function Line({ width, tone = "soft" }: { width: string; tone?: "soft" | "strong" }) {
  return (
    <span
      aria-hidden
      style={{ width }}
      className={cn(
        "block h-3 rounded-full motion-safe:animate-pulse",
        tone === "strong" ? "bg-line-strong" : "bg-line",
      )}
    />
  );
}

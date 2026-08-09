import { Pulse } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  name = "Doctor AI",
}: {
  className?: string;
  name?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-md bg-accent text-on-accent"
      >
        <Pulse size={18} weight="bold" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-ink">{name}</span>
    </span>
  );
}

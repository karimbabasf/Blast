import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { LogEntry, LogTone } from "../_data/use-work-log";
import { cn } from "@/lib/utils";

const DOT: Record<LogTone, string> = {
  info: "bg-muted-foreground/50",
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
};

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// The manager's work, one line per real event. The box has a fixed height
// and scrolls inside, so new lines never push the page.
export function WorkLog({ entries }: { entries: LogEntry[] }) {
  const box = useRef<HTMLOListElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [entries.length]);

  return (
    <section
      aria-label="Manager Work Log"
      className="rounded-xl bg-muted/60 px-4 py-3"
    >
      <ol
        ref={box}
        role="log"
        aria-live="polite"
        className="flex h-20 flex-col gap-1 overflow-y-auto overscroll-contain text-sm"
      >
        {entries.length === 0 && (
          <li className="text-muted-foreground/70">
            The manager’s work shows up here, line by line.
          </li>
        )}
        {entries.map((entry, index) => (
          <motion.li
            key={entry.id}
            initial={{ opacity: 0, transform: "translateY(4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "flex shrink-0 items-baseline gap-2.5",
              index < entries.length - 1 && "text-muted-foreground",
            )}
          >
            <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {clock(entry.seconds)}
            </span>
            <span
              aria-hidden="true"
              className={cn("size-1.5 shrink-0 -translate-y-0.5 rounded-full", DOT[entry.tone])}
            />
            <span className="min-w-0 truncate">{entry.text}</span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

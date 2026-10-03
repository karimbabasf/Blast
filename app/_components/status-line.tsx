import type { RunStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS: { status: RunStatus; label: string }[] = [
  { status: "splitting", label: "Split" },
  { status: "auditioning", label: "Audition" },
  { status: "waiting", label: "Approve" },
  { status: "hiring", label: "Hire" },
  { status: "done", label: "Done" },
];

// Five equal segments that are always on screen. A run only changes their
// color, so the row never changes size.
export function StatusLine({ status }: { status: RunStatus | null }) {
  const current = STEPS.findIndex((step) => step.status === status);

  return (
    <div>
      <ol className="grid grid-cols-5 gap-2">
        {STEPS.map((step, index) => {
          const reached = current >= index;
          const active = index === current && status !== "done";
          return (
            <li
              key={step.status}
              aria-current={index === current ? "step" : undefined}
              className="flex flex-col gap-1.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1 rounded-full bg-muted transition-colors duration-200 ease-out",
                  reached && "bg-foreground",
                  active && "animate-pulse",
                )}
              />
              <span
                className={cn(
                  "text-xs text-muted-foreground/60 transition-colors duration-200 ease-out",
                  reached && "font-medium text-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {STEPS[current]?.label}
      </p>
    </div>
  );
}

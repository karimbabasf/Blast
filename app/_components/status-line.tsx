import type { RunStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS: { status: RunStatus; label: string }[] = [
  { status: "splitting", label: "Splitting the Goal" },
  { status: "auditioning", label: "Auditioning" },
  { status: "waiting", label: "Waiting for Approval" },
  { status: "hiring", label: "Hiring" },
  { status: "done", label: "Done" },
];

export function StatusLine({ status }: { status: RunStatus }) {
  const current = STEPS.findIndex((step) => step.status === status);

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {STEPS.map((step, index) => (
          <li key={step.status} className="flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className="h-px w-4 bg-border" />
            )}
            <span
              aria-current={index === current ? "step" : undefined}
              className={cn(
                "transition-colors duration-200 ease-out",
                index === current && "font-medium text-foreground",
                index < current && "text-muted-foreground",
                index > current && "text-muted-foreground/50",
              )}
            >
              {step.label}
              {index === current && status !== "done" && "…"}
            </span>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {STEPS[current]?.label}
      </p>
    </div>
  );
}

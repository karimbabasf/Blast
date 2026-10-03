import { RUN_BUDGET_CENTS, type RunMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { money } from "./format";

const OPTIONS: { value: RunMode; label: string; hint: string }[] = [
  { value: "approve", label: "Approve", hint: "You approve each hire." },
  {
    value: "auto",
    label: "Auto",
    hint: `Hires inside a ${money(RUN_BUDGET_CENTS)} budget.`,
  },
];

export function ModeDial({
  mode,
  onChange,
  disabled,
}: {
  mode: RunMode;
  onChange: (mode: RunMode) => void;
  disabled: boolean;
}) {
  const hint = OPTIONS.find((option) => option.value === mode)?.hint;

  return (
    <fieldset disabled={disabled} className="flex flex-col items-end gap-1.5">
      <legend className="sr-only">Hiring Mode</legend>
      <div className="flex rounded-lg bg-muted p-0.5">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground outline-none transition-[scale,background-color,color] duration-150 ease-out",
              "focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] disabled:opacity-50",
              "aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs",
              "[@media(hover:hover)]:hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </fieldset>
  );
}

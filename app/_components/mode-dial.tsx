import { RUN_BUDGET_CENTS, type RunMode } from "@/lib/types";
import { SegmentedControl } from "@/components/interior/segmented-control";
import { money } from "./format";

const HINT: Record<RunMode, string> = {
  approve: "You approve each hire.",
  auto: `Hires inside a ${money(RUN_BUDGET_CENTS)} budget.`,
};

export function ModeDial({
  mode,
  onChange,
  disabled,
}: {
  mode: RunMode;
  onChange: (mode: RunMode) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <SegmentedControl
        label="Hiring Mode"
        value={mode}
        onValueChange={(next) => onChange(next as RunMode)}
        options={[
          { value: "approve", label: "Approve", disabled },
          { value: "auto", label: "Auto", disabled },
        ]}
      />
      <p className="text-xs text-muted-foreground">{HINT[mode]}</p>
    </div>
  );
}

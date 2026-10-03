import { RUN_BUDGET_CENTS, type RunMode } from "@/lib/types";
import { SegmentedControl } from "@/components/interior/segmented-control";
import { money } from "./format";

// Who is buying: you with an approve step, you on auto, or an outside agent.
export type Buyer = RunMode | "agent";

const HINT: Record<Buyer, string> = {
  approve: "You approve each hire.",
  auto: `Hires inside a ${money(RUN_BUDGET_CENTS)} budget.`,
  agent: "An outside agent pays Blast over HTTP.",
};

export function ModeDial({
  buyer,
  onChange,
  disabled,
  agentReady,
}: {
  buyer: Buyer;
  onChange: (buyer: Buyer) => void;
  disabled: boolean;
  agentReady: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <SegmentedControl
        label="Who Is Buying"
        value={buyer}
        onValueChange={(next) => onChange(next as Buyer)}
        options={[
          { value: "approve", label: "Approve", disabled },
          { value: "auto", label: "Auto", disabled },
          ...(agentReady ? [{ value: "agent", label: "Agent", disabled }] : []),
        ]}
      />
      <p className="text-xs text-muted-foreground">{HINT[buyer]}</p>
    </div>
  );
}

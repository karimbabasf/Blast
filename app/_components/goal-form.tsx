import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function GoalForm({
  defaultGoal,
  busy,
  done,
  onStart,
}: {
  defaultGoal: string;
  busy: boolean;
  done: boolean;
  onStart: (goal: string) => void;
}) {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const goal = String(new FormData(event.currentTarget).get("goal") ?? "");
        if (goal.trim()) onStart(goal.trim());
      }}
    >
      <label htmlFor="goal" className="text-sm font-medium">
        Your Goal
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Textarea
          id="goal"
          name="goal"
          rows={2}
          required
          autoComplete="off"
          defaultValue={defaultGoal}
          placeholder="Make me a 15 second radio ad for my coffee shop…"
          className="min-h-16 flex-1 text-base"
        />
        <Button type="submit" size="lg" disabled={busy} className="sm:mt-0.5">
          {busy ? "Working…" : done ? "Run Again" : "Start Auditions"}
        </Button>
      </div>
    </form>
  );
}

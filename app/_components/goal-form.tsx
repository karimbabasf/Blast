import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GoalForm({
  defaultGoal,
  busy,
  done,
  error,
  onStart,
}: {
  defaultGoal: string;
  busy: boolean;
  done: boolean;
  error: string | null;
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
      <div className="flex gap-3">
        <Input
          id="goal"
          name="goal"
          required
          autoComplete="off"
          defaultValue={defaultGoal}
          placeholder="Make me a 15 second radio ad for my coffee shop…"
          className="h-11 flex-1 px-3.5 text-base md:text-base"
        />
        <Button type="submit" disabled={busy} className="h-11 w-36 text-sm">
          {busy ? "Working…" : done ? "Run Again" : "Start Auditions"}
        </Button>
      </div>
      <p aria-live="polite" className="h-4 truncate text-xs text-destructive">
        {error}
      </p>
    </form>
  );
}

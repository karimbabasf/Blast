"use client";

import { useState } from "react";
import { MotionConfig } from "motion/react";
import type { RunMode } from "@/lib/types";
import { DEFAULT_GOAL } from "../_data/fake";
import { useRun } from "../_data/use-run";
import { Board } from "./board";
import { GoalForm } from "./goal-form";
import { ModeDial } from "./mode-dial";
import { StatusLine } from "./status-line";
import { Summary } from "./summary";

// Every region is laid out before the first click. A run fills the regions
// in place, so nothing appears, disappears or pushes the page around.
export function Blast() {
  const { run, jobs, auditions, payments, cards, start, approve } = useRun();
  const [mode, setMode] = useState<RunMode>("approve");
  const busy = run !== null && run.status !== "done";

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight" translate="no">
              Blast
            </h1>
            <p className="text-sm text-muted-foreground">
              A manager agent that auditions and hires other agents for you.
            </p>
          </div>
          <ModeDial mode={mode} onChange={setMode} disabled={busy} />
        </header>

        <GoalForm
          defaultGoal={DEFAULT_GOAL}
          busy={busy}
          done={run?.status === "done"}
          onStart={(goal) => start(goal, mode)}
        />

        <StatusLine status={run?.status ?? null} />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Board jobs={jobs} auditions={auditions} cards={cards} />
          <Summary
            run={run}
            mode={run?.mode ?? mode}
            jobs={jobs}
            auditions={auditions}
            payments={payments}
            cards={cards}
            onApprove={approve}
            className="lg:sticky lg:top-6"
          />
        </div>
      </main>
    </MotionConfig>
  );
}

"use client";

import { useState } from "react";
import { MotionConfig } from "motion/react";
import { DEFAULT_GOAL } from "../_data/fake";
import { useRun } from "../_data/use-run";
import { useScorecard } from "../_data/use-scorecard";
import { useWorkLog } from "../_data/use-work-log";
import { Board } from "./board";
import { GoalForm } from "./goal-form";
import { ModeDial, type Buyer } from "./mode-dial";
import { StatusLine } from "./status-line";
import { Summary } from "./summary";
import { WorkLog } from "./work-log";

// Every region is laid out before the first click. A run fills the regions
// in place, so nothing appears, disappears or pushes the page around.
export function Blast() {
  const {
    run,
    jobs,
    auditions,
    payments,
    notes,
    cards,
    error,
    start,
    startAgent,
    approve,
    reject,
  } = useRun();
  const log = useWorkLog({ run, jobs, auditions, payments, notes }, cards);
  const [buyer, setBuyer] = useState<Buyer>("approve");
  const busy = run !== null && run.status !== "done";
  // Reload the track records once a run has finished and added to them.
  const records = useScorecard(run?.status === "done" ? run.id : "idle");

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-6 py-5">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight" translate="no">
              Blast
            </h1>
            <p className="text-sm text-muted-foreground">
              A manager agent that auditions and hires other agents for you.
            </p>
          </div>
          <ModeDial
            buyer={buyer}
            onChange={setBuyer}
            disabled={busy}
            agentReady={Boolean(startAgent)}
          />
        </header>

        <GoalForm
          defaultGoal={DEFAULT_GOAL}
          busy={busy}
          done={run?.status === "done"}
          error={error}
          startLabel={buyer === "agent" ? "Send an Agent" : "Start Auditions"}
          onStart={(goal) =>
            buyer === "agent" ? startAgent?.(goal) : start(goal, buyer)
          }
        />

        <div className="flex flex-col gap-3">
          <StatusLine status={run?.status ?? null} />
          <WorkLog entries={log} />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Board
            jobs={jobs}
            auditions={auditions}
            cards={cards}
            records={records}
          />
          <Summary
            run={run}
            mode={run?.mode ?? (buyer === "approve" ? "approve" : "auto")}
            agentPays={buyer === "agent"}
            jobs={jobs}
            auditions={auditions}
            payments={payments}
            cards={cards}
            onApprove={approve}
            onReject={reject}
            className="lg:sticky lg:top-6"
          />
        </div>
      </main>
    </MotionConfig>
  );
}

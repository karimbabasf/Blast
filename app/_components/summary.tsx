import { motion } from "motion/react";
import {
  RUN_BUDGET_CENTS,
  RUN_PRICE_CENTS,
  type AgentCard,
  type Audition,
  type Job,
  type Payment,
  type Run,
  type RunMode,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlayButton, POP } from "./audition-card";
import { SKILLS } from "./board";
import { money, SKILL_LABEL } from "./format";

function topAudition(job: Job, auditions: Audition[]) {
  return auditions
    .filter((a) => a.job_id === job.id && a.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
}

// The right rail. Every row, the button and the ad box are on screen from
// the start and only their contents change, so approving moves nothing.
export function Summary({
  run,
  mode,
  jobs,
  auditions,
  payments,
  cards,
  onApprove,
  className,
}: {
  run: Run | null;
  mode: RunMode;
  jobs: Job[];
  auditions: Audition[];
  payments: Payment[];
  cards: AgentCard[];
  onApprove: () => void;
  className?: string;
}) {
  const status = run?.status ?? null;
  const price = run?.price_cents ?? RUN_PRICE_CENTS;
  const budget = run?.budget_cents ?? RUN_BUDGET_CENTS;
  const spent = payments.reduce((sum, p) => sum + p.amount_cents, 0);

  const rows = SKILLS.map((skill) => {
    const job = jobs.find((j) => j.skill === skill);
    const payment = job && payments.find((p) => p.job_id === job.id);
    const pick =
      job && (status === "waiting" || status === "hiring" || status === "done")
        ? topAudition(job, auditions)
        : undefined;
    const card = cards.find(
      (c) => c.id === (payment?.agent_id ?? pick?.agent_id),
    );
    return { skill, payment, card };
  });
  const planned = rows.reduce((sum, r) => sum + (r.card?.price_cents ?? 0), 0);

  const script = jobs.find((job) => job.skill === "script");
  const voice = jobs.find((job) => job.skill === "voice");
  const canApprove = status === "waiting" && mode === "approve";

  const button =
    mode === "auto"
      ? "Auto Hiring On"
      : status === "hiring"
        ? "Hiring…"
        : status === "done"
          ? "Hired"
          : "Approve Hires";

  return (
    <aside
      aria-label="Hires and Receipt"
      className={cn("flex flex-col gap-5 rounded-2xl bg-muted p-5", className)}
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Hires</h2>
        <dl className="flex flex-col gap-3">
          {rows.map(({ skill, payment, card }) => (
            <div key={skill} className="flex h-10 items-start justify-between gap-3">
              <dt className="min-w-0 text-sm">
                <span className="text-muted-foreground">
                  {SKILL_LABEL[skill]}
                </span>
                {card ? (
                  <motion.span
                    key={card.id}
                    {...POP}
                    className="block truncate font-medium"
                    translate="no"
                  >
                    {card.name}
                    {!payment && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · top pick
                      </span>
                    )}
                  </motion.span>
                ) : (
                  <span className="block text-muted-foreground/60">
                    Not picked yet
                  </span>
                )}
              </dt>
              <dd className="pt-5 text-sm text-muted-foreground tabular-nums">
                {card ? money(card.price_cents) : money(0)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-1.5">
        <Button
          size="lg"
          disabled={!canApprove}
          onClick={onApprove}
          className="h-11 w-full text-sm"
        >
          {button}
        </Button>
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {money(planned)} of your {money(budget)} budget
        </p>
      </div>

      <dl className="flex flex-col gap-2 border-t border-foreground/10 pt-4 text-sm tabular-nums">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">You pay</dt>
          <dd>{money(price)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Paid to agents</dt>
          <dd>{money(spent)}</dd>
        </div>
        <div className="flex justify-between gap-4 font-semibold">
          <dt>Margin</dt>
          <dd>{money(price - spent)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 border-t border-foreground/10 pt-4">
        <div className="flex h-6 items-center justify-between">
          <h2 className="text-base font-semibold">Your Ad</h2>
          {voice?.audio_url && (
            <PlayButton src={voice.audio_url} label="finished ad" />
          )}
        </div>
        <div className="h-28 overflow-y-auto text-sm text-pretty">
          {script?.output_text ? (
            <motion.p {...POP}>“{script.output_text}”</motion.p>
          ) : (
            <p className="text-muted-foreground/60">
              The finished ad shows up here.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

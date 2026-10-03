import { motion } from "motion/react";
import type { AgentCard, Audition, Job, Payment, Run } from "@/lib/types";
import { money, SKILL_LABEL } from "./format";

export function Receipt({
  run,
  jobs,
  payments,
  cards,
  auditions,
}: {
  run: Run;
  jobs: Job[];
  payments: Payment[];
  cards: AgentCard[];
  auditions: Audition[];
}) {
  const spent = payments.reduce((sum, p) => sum + p.amount_cents, 0);
  const script = jobs.find((job) => job.skill === "script");
  const voice = jobs.find((job) => job.skill === "voice");

  return (
    <motion.section
      aria-label="Receipt"
      initial={{ opacity: 0, transform: "translateY(8px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="grid gap-6 rounded-xl bg-card p-6 ring-1 ring-foreground/10 md:grid-cols-2"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="text-base font-semibold">Your Ad</h2>
        {voice?.audio_url && (
          <audio
            controls
            src={voice.audio_url}
            className="h-10 w-full"
            aria-label="Finished radio ad"
          />
        )}
        {script?.output_text && (
          <blockquote className="border-l-2 border-border pl-3 text-sm text-pretty">
            “{script.output_text}”
          </blockquote>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="text-base font-semibold">Receipt</h2>
        <dl className="flex flex-col gap-2 text-sm tabular-nums">
          <div className="flex justify-between gap-4">
            <dt>You paid</dt>
            <dd className="font-medium">{money(run.price_cents)}</dd>
          </div>
          {payments.map((payment) => {
            const job = jobs.find((j) => j.id === payment.job_id);
            const card = cards.find((c) => c.id === payment.agent_id);
            const reason = auditions.find(
              (a) =>
                a.job_id === payment.job_id && a.agent_id === payment.agent_id,
            )?.reason;
            return (
              <div key={payment.id} className="flex justify-between gap-4">
                <dt className="min-w-0 text-muted-foreground">
                  <span className="text-foreground" translate="no">
                    {card?.name}
                  </span>{" "}
                  · {job && SKILL_LABEL[job.skill]}
                  {reason && <span className="block text-xs">{reason}</span>}
                </dt>
                <dd className="text-muted-foreground">
                  {money(-payment.amount_cents)}
                </dd>
              </div>
            );
          })}
          <div className="flex justify-between gap-4 border-t border-border pt-2">
            <dt className="font-medium">Margin</dt>
            <dd className="font-semibold">{money(run.price_cents - spent)}</dd>
          </div>
        </dl>
      </div>
    </motion.section>
  );
}

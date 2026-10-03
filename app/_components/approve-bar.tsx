import { motion } from "motion/react";
import type { AgentCard, Audition, Job } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { money, SKILL_LABEL } from "./format";

export function topAudition(job: Job, auditions: Audition[]) {
  return auditions
    .filter((a) => a.job_id === job.id && a.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
}

export function ApproveBar({
  jobs,
  auditions,
  cards,
  budgetCents,
  onApprove,
}: {
  jobs: Job[];
  auditions: Audition[];
  cards: AgentCard[];
  budgetCents: number;
  onApprove: () => void;
}) {
  const picks = [...jobs]
    .sort((a, b) => a.order - b.order)
    .flatMap((job) => {
      const card = cards.find(
        (c) => c.id === topAudition(job, auditions)?.agent_id,
      );
      return card ? [{ job, card }] : [];
    });
  const total = picks.reduce((sum, pick) => sum + pick.card.price_cents, 0);

  return (
    <motion.section
      aria-label="Approve Hires"
      initial={{ opacity: 0, transform: "translateY(8px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted p-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">
          Hire{" "}
          {picks.map((pick, index) => (
            <span key={pick.job.id}>
              {index > 0 && " & "}
              <span translate="no">{pick.card.name}</span> for{" "}
              {SKILL_LABEL[pick.job.skill].toLowerCase()}
            </span>
          ))}
          ?
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {money(total)} of your {money(budgetCents)} budget
        </p>
      </div>
      <Button size="lg" onClick={onApprove}>
        Approve Hires
      </Button>
    </motion.section>
  );
}

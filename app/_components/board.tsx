import { motion } from "motion/react";
import type { AgentCard, Audition, Job } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { AuditionCard } from "./audition-card";
import { SKILL_LABEL } from "./format";

const JOB_BADGE: Record<Job["status"], string> = {
  auditioning: "Auditioning…",
  waiting: "Scored",
  hired: "Hired",
  done: "Done",
};

export function Board({
  jobs,
  auditions,
  cards,
}: {
  jobs: Job[];
  auditions: Audition[];
  cards: AgentCard[];
}) {
  const byId = new Map(cards.map((card) => [card.id, card]));

  return (
    <section aria-label="Auditions" className="grid gap-6 md:grid-cols-2">
      {[...jobs]
        .sort((a, b) => a.order - b.order)
        .map((job) => {
          const mine = auditions.filter((a) => a.job_id === job.id);
          const active = mine
            .filter((a) => a.status !== "skipped")
            .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
          const skipped = mine.filter((a) => a.status === "skipped");
          const top = active[0]?.score != null ? active[0].agent_id : null;

          return (
            <div key={job.id} className="flex min-w-0 flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">
                    {SKILL_LABEL[job.skill]}
                  </h2>
                  <p className="text-sm text-pretty text-muted-foreground">
                    {job.brief}
                  </p>
                </div>
                <Badge variant="outline">{JOB_BADGE[job.status]}</Badge>
              </div>

              <ul className="flex flex-col gap-2">
                {active.map((audition, index) => {
                  const card = byId.get(audition.agent_id);
                  if (!card) return null;
                  return (
                    <motion.li
                      key={audition.id}
                      layout="position"
                      initial={{ opacity: 0, transform: "translateY(8px)" }}
                      animate={{ opacity: 1, transform: "translateY(0px)" }}
                      transition={{
                        layout: { type: "spring", duration: 0.4, bounce: 0 },
                        default: {
                          duration: 0.25,
                          delay: index * 0.05,
                          ease: [0.23, 1, 0.32, 1],
                        },
                      }}
                    >
                      <AuditionCard
                        audition={audition}
                        card={card}
                        hired={job.winner_agent_id === audition.agent_id}
                        top={
                          job.status === "waiting" &&
                          top === audition.agent_id
                        }
                      />
                    </motion.li>
                  );
                })}
              </ul>

              {skipped.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted-foreground">
                    {skipped.length} skipped · wrong skill or not available
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {skipped.map((audition) => (
                      <li
                        key={audition.id}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        translate="no"
                      >
                        {byId.get(audition.agent_id)?.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
    </section>
  );
}

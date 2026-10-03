import { motion } from "motion/react";
import type { AgentCard, Audition, Job, Skill } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { AuditionCard, EmptySlot } from "./audition-card";
import { SKILL_LABEL } from "./format";

export const SKILLS: Skill[] = ["script", "voice"];
const SLOTS = 3;

const JOB_BADGE: Record<Job["status"], string> = {
  auditioning: "Auditioning…",
  waiting: "Scored",
  hired: "Hired",
  done: "Done",
};

// Both columns, their slots and the skipped strip are on screen from the
// start. A run fills them in place, so the page never changes height.
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
      {SKILLS.map((skill) => {
        const job = jobs.find((j) => j.skill === skill);
        const mine = job ? auditions.filter((a) => a.job_id === job.id) : [];
        const active = mine
          .filter((a) => a.status !== "skipped")
          .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
        const skipped = mine.filter((a) => a.status === "skipped");
        const top = active[0]?.score != null ? active[0].agent_id : null;
        const empty = Math.max(0, SLOTS - active.length);

        return (
          <div key={skill} className="flex min-w-0 flex-col gap-3">
            <div className="flex h-11 items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base leading-6 font-semibold">
                  {SKILL_LABEL[skill]}
                </h2>
                <p className="truncate text-sm text-muted-foreground">
                  {job?.brief ?? "Waiting for a goal."}
                </p>
              </div>
              <Badge variant="outline">
                {job ? JOB_BADGE[job.status] : "Idle"}
              </Badge>
            </div>

            <ul className="flex flex-col gap-2">
              {active.map((audition, index) => {
                const card = byId.get(audition.agent_id);
                if (!card) return null;
                return (
                  <motion.li
                    key={audition.id}
                    layout="position"
                    initial={{ opacity: 0, transform: "scale(0.97)" }}
                    animate={{ opacity: 1, transform: "scale(1)" }}
                    transition={{
                      layout: { type: "spring", duration: 0.4, bounce: 0 },
                      default: {
                        duration: 0.22,
                        delay: index * 0.05,
                        ease: [0.23, 1, 0.32, 1],
                      },
                    }}
                  >
                    <AuditionCard
                      audition={audition}
                      card={card}
                      hired={job?.winner_agent_id === audition.agent_id}
                      top={job?.status === "waiting" && top === audition.agent_id}
                    />
                  </motion.li>
                );
              })}
              {Array.from({ length: empty }, (_, index) => (
                <li key={`slot-${index}`}>
                  <EmptySlot />
                </li>
              ))}
            </ul>

            <div className="flex h-20 flex-col gap-1.5 overflow-hidden">
              <p className="text-xs text-muted-foreground">
                {skipped.length} skipped · wrong skill or not available
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {skipped.map((audition, index) => (
                  <motion.li
                    key={audition.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    translate="no"
                  >
                    {byId.get(audition.agent_id)?.name}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </section>
  );
}

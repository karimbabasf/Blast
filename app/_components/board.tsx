import { motion } from "motion/react";
import type { AgentCard, Audition, Job, Skill } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { AgentAvatar } from "./agent-avatar";
import type { TrackRecord } from "../_data/use-scorecard";
import { AuditionCard, BenchCard, EmptySlot } from "./audition-card";
import { SKILL_LABEL } from "./format";

export const SKILLS: Skill[] = ["script", "voice"];
const SLOTS = 3;

const JOB_BADGE: Record<Job["status"], { label: string; tone: string }> = {
  auditioning: { label: "Auditioning…", tone: "animate-pulse" },
  waiting: { label: "Scored", tone: "" },
  hired: { label: "Hiring…", tone: "border-transparent bg-success/10 text-success" },
  done: { label: "Done", tone: "border-transparent bg-success/10 text-success" },
};

// Both columns, their slots and the skipped strip are on screen from the
// start. A run fills them in place, so the page never changes height.
export function Board({
  jobs,
  auditions,
  cards,
  records,
}: {
  jobs: Job[];
  auditions: Audition[];
  cards: AgentCard[];
  records: Map<string, TrackRecord>;
}) {
  const byId = new Map(cards.map((card) => [card.id, card]));

  return (
    <section aria-label="Auditions" className="grid gap-6 md:grid-cols-2">
      {SKILLS.map((skill) => {
        const job = jobs.find((j) => j.skill === skill);
        const mine = job ? auditions.filter((a) => a.job_id === job.id) : [];
        const active = mine
          .filter((a) => a.status !== "skipped")
          .sort(
            (a, b) =>
              Number(b.score ?? -1) - Number(a.score ?? -1) ||
              (byId.get(a.agent_id)?.price_cents ?? 0) -
                (byId.get(b.agent_id)?.price_cents ?? 0),
          );
        const skipped = mine.filter((a) => a.status === "skipped");
        const top = active[0]?.score != null ? active[0].agent_id : null;
        // Before a run, the slots hold the agents on the bench, best record first.
        const bench = job
          ? []
          : cards
              .filter((card) => card.real && card.skills.includes(skill))
              .sort(
                (a, b) =>
                  (records.get(b.id)?.avg_score ?? -1) -
                  (records.get(a.id)?.avg_score ?? -1),
              )
              .slice(0, SLOTS);
        const empty = Math.max(0, SLOTS - active.length - bench.length);

        return (
          <div key={skill} className="flex min-w-0 flex-col gap-3">
            <div className="flex h-11 items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base leading-6 font-semibold">
                  {SKILL_LABEL[skill]}
                </h2>
                <p className="truncate text-sm text-muted-foreground">
                  {job?.brief ?? "On the bench, ranked by track record."}
                </p>
              </div>
              <Badge
                variant="outline"
                className={job ? JOB_BADGE[job.status].tone : "text-muted-foreground"}
              >
                {job ? JOB_BADGE[job.status].label : "Idle"}
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
                      layout: { type: "spring", stiffness: 520, damping: 34, mass: 0.45 },
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
              {bench.map((card) => (
                <li key={`bench-${card.id}`}>
                  <BenchCard card={card} record={records.get(card.id)} />
                </li>
              ))}
              {Array.from({ length: empty }, (_, index) => (
                <li key={`slot-${index}`}>
                  <EmptySlot />
                </li>
              ))}
            </ul>

            <div className="flex h-6 items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {skipped.length} skipped
              </p>
              <ul className="flex -space-x-1.5">
                {skipped.map((audition, index) => {
                  const card = byId.get(audition.agent_id);
                  if (!card) return null;
                  return (
                    <motion.li
                      key={audition.id}
                      initial={{ opacity: 0, transform: "scale(0.9)" }}
                      animate={{ opacity: 1, transform: "scale(1)" }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="flex"
                    >
                      <AgentAvatar
                        card={card}
                        size="xs"
                        className="text-muted-foreground ring-2 ring-background"
                      />
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </section>
  );
}

import { motion } from "motion/react";
import type { AgentCard, Audition } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { money } from "./format";

export function AuditionCard({
  audition,
  card,
  hired,
  top,
}: {
  audition: Audition;
  card: AgentCard;
  hired: boolean;
  top: boolean;
}) {
  const scored = audition.status === "scored" && audition.score !== null;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow duration-200 ease-out",
        hired && "ring-2 ring-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold" translate="no">
              {card.name}
            </h3>
            {hired && <Badge>Hired</Badge>}
            {top && !hired && <Badge variant="secondary">Top Score</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {card.description}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end">
          {scored ? (
            <motion.p
              initial={{ opacity: 0, filter: "blur(4px)", transform: "scale(0.9)" }}
              animate={{ opacity: 1, filter: "blur(0px)", transform: "scale(1)" }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="text-2xl leading-none font-semibold tabular-nums"
            >
              {audition.score}
              <span className="text-sm font-normal text-muted-foreground">
                /10
              </span>
            </motion.p>
          ) : (
            <p className="animate-pulse text-sm text-muted-foreground">
              {audition.status === "failed" ? "Failed" : "Auditioning…"}
            </p>
          )}
          <p className="text-xs text-muted-foreground tabular-nums">
            {money(card.price_cents)}
          </p>
        </div>
      </div>

      {scored && (
        <div className="flex flex-col gap-2">
          {audition.output_text && (
            <blockquote className="line-clamp-3 border-l-2 border-border pl-3 text-sm text-pretty">
              “{audition.output_text}”
            </blockquote>
          )}
          {audition.audio_url && (
            <audio
              controls
              preload="none"
              src={audition.audio_url}
              className="h-9 w-full"
              aria-label={`${card.name} sample`}
            />
          )}
          <p className="text-xs text-muted-foreground">{audition.reason}</p>
        </div>
      )}
    </article>
  );
}

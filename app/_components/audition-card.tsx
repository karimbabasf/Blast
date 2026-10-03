import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Pause, Play } from "lucide-react";
import type { AgentCard, Audition } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";
import { money } from "./format";

// Every card and every empty slot is this tall, so nothing below ever moves.
const CARD_HEIGHT = "h-38";

export const POP = {
  initial: { opacity: 0, filter: "blur(4px)", transform: "scale(0.96)" },
  animate: { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
  transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] as const },
};

export function EmptySlot() {
  return (
    <div
      className={cn(
        CARD_HEIGHT,
        "flex items-center justify-center rounded-xl bg-muted/50 text-sm text-muted-foreground/70",
      )}
    >
      Waiting for an agent
    </div>
  );
}

export function PlayButton({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        onClick={() =>
          playing ? audio.current?.pause() : audio.current?.play()
        }
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background outline-none transition-[scale] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.94]"
      >
        {playing ? (
          <Pause aria-hidden="true" className="size-3" />
        ) : (
          <Play aria-hidden="true" className="size-3" />
        )}
      </button>
    </>
  );
}

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
        CARD_HEIGHT,
        "flex flex-col gap-3 overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow duration-200 ease-out",
        hired && "ring-2 ring-foreground",
      )}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar
          card={card}
          status={scored ? undefined : "working"}
          verified={hired}
        />
        <div className="min-w-0 flex-1">
          <div className="flex h-5 items-center gap-2">
            <h3 className="text-sm font-semibold" translate="no">
              {card.name}
            </h3>
            {scored && audition.audio_url && (
              <PlayButton src={audition.audio_url} label={`${card.name} sample`} />
            )}
            {hired && <Badge>Hired</Badge>}
            {top && !hired && <Badge variant="secondary">Top Score</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {card.description}
          </p>
        </div>

        <div className="flex w-14 shrink-0 flex-col items-end">
          <div className="flex h-6 items-end">
            {scored ? (
              <motion.p
                {...POP}
                className="text-2xl leading-none font-semibold tabular-nums"
              >
                {audition.score}
                <span className="text-sm font-normal text-muted-foreground">
                  /10
                </span>
              </motion.p>
            ) : (
              <p className="animate-pulse text-sm text-muted-foreground">
                {audition.status === "failed" ? "Failed" : "…"}
                <span className="sr-only">Auditioning</span>
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {money(card.price_cents)}
          </p>
        </div>
      </div>

      {scored ? (
        <motion.div {...POP} className="flex flex-col gap-1.5">
          <blockquote className="line-clamp-2 h-10 border-l-2 border-border pl-3 text-sm">
            “{audition.output_text}”
          </blockquote>
          <p className="truncate text-xs text-muted-foreground">
            {audition.reason}
          </p>
        </motion.div>
      ) : (
        <div aria-hidden="true" className="flex animate-pulse flex-col gap-1.5">
          <div className="flex h-10 flex-col justify-center gap-2 border-l-2 border-border pl-3">
            <div className="h-2.5 w-11/12 rounded-full bg-muted" />
            <div className="h-2.5 w-7/12 rounded-full bg-muted" />
          </div>
          <div className="h-4 w-8/12 rounded-full bg-muted" />
        </div>
      )}
    </article>
  );
}

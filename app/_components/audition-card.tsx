import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { AUDITION_VOICE_LINE, type AgentCard, type Audition } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";
import type { TrackRecord } from "../_data/use-scorecard";
import { money } from "./format";

// Every card and every empty slot is this tall, so nothing below ever moves.
const CARD_HEIGHT = "h-35";

export const POP = {
  initial: { opacity: 0, filter: "blur(4px)", transform: "scale(0.96)" },
  animate: { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
  transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] as const },
};

// Green for a strong score, amber for a middling one, red for a weak one.
export function scoreTone(score: number) {
  if (score >= 8) return "bg-success/10 text-success";
  if (score >= 5) return "bg-warning/15 text-warning";
  return "bg-destructive/10 text-destructive";
}

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

// An agent before any run: who it is and how it has done in past auditions.
export function BenchCard({
  card,
  record,
}: {
  card: AgentCard;
  record: TrackRecord | undefined;
}) {
  const average = record?.avg_score ?? null;
  const stats = [
    { label: "Auditions", value: String(record?.auditions ?? 0), tone: "" },
    { label: "Hires", value: String(record?.hires ?? 0), tone: "" },
  ];

  return (
    <article
      className={cn(
        CARD_HEIGHT,
        "flex flex-col gap-2 overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10",
      )}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar card={card} />
        <div className="min-w-0 flex-1">
          <h3 className="h-5 text-sm font-semibold" translate="no">
            {card.name}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {card.description}
          </p>
        </div>
        <div className="flex w-14 shrink-0 flex-col items-end">
          <div className="flex h-7 items-center">
            {average === null ? (
              <p className="text-xs text-muted-foreground">New</p>
            ) : (
              <p
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-lg leading-none font-semibold tabular-nums",
                  scoreTone(average),
                )}
              >
                {average}
                <span className="text-xs font-normal opacity-70">/10</span>
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {money(card.price_cents)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <dl className="flex h-10 items-center gap-6 border-l-2 border-border pl-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <dd className="text-sm leading-5 font-semibold tabular-nums">
                {stat.value}
              </dd>
              <dt className="text-xs leading-4 text-muted-foreground">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
        <p className="truncate text-xs text-muted-foreground">
          {average === null
            ? "No track record yet"
            : "Average score across past auditions"}
        </p>
      </div>
    </article>
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
  const failed = audition.status === "failed";
  const voice = card.skills.includes("voice");
  // The sample lands before the score, so the card shows it right away.
  const delivered = Boolean(audition.output_text || audition.audio_url);
  const sample =
    audition.output_text ?? (audition.audio_url ? AUDITION_VOICE_LINE : null);
  const stage = scored || failed
    ? audition.reason
    : delivered
      ? "Judge is scoring…"
      : voice
        ? "Recording a sample…"
        : "Writing a sample…";

  return (
    <article
      className={cn(
        CARD_HEIGHT,
        "flex flex-col gap-2 overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-shadow duration-200 ease-out",
        hired && "ring-2 ring-success",
      )}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar
          card={card}
          status={audition.status === "running" ? "working" : undefined}
          verified={hired}
        />
        <div className="min-w-0 flex-1">
          <div className="flex h-5 items-center gap-2">
            <h3 className="text-sm font-semibold" translate="no">
              {card.name}
            </h3>
            {audition.audio_url && (
              <PlayButton src={audition.audio_url} label={`${card.name} sample`} />
            )}
            {hired && <Badge className="bg-success text-white">Hired</Badge>}
            {top && !hired && (
              <Badge className="bg-success/10 text-success">Top Score</Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {card.description}
          </p>
        </div>

        <div className="flex w-14 shrink-0 flex-col items-end">
          <div className="flex h-7 items-center">
            {scored ? (
              <motion.p
                {...POP}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-lg leading-none font-semibold tabular-nums",
                  scoreTone(Number(audition.score)),
                )}
              >
                {Number(audition.score)}
                <span className="text-xs font-normal opacity-70">/10</span>
              </motion.p>
            ) : audition.status === "failed" ? (
              <p className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                Failed
              </p>
            ) : (
              <p className="animate-pulse text-sm text-muted-foreground">
                …<span className="sr-only">Auditioning</span>
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {money(card.price_cents)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {sample ? (
          <motion.blockquote
            {...POP}
            className="line-clamp-2 h-10 border-l-2 border-border pl-3 text-sm"
          >
            “{sample}”
          </motion.blockquote>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-10 animate-pulse flex-col justify-center gap-2 border-l-2 border-border pl-3"
          >
            <div className="h-2.5 w-11/12 rounded-full bg-muted" />
            <div className="h-2.5 w-7/12 rounded-full bg-muted" />
          </div>
        )}
        <p
          key={stage}
          className={cn(
            "truncate text-xs text-muted-foreground",
            !scored && !failed && "animate-pulse",
            failed && "text-destructive",
          )}
        >
          {stage}
        </p>
      </div>
    </article>
  );
}

"use client";

import { useEffect, useState } from "react";

export type TrackRecord = {
  agent_id: string;
  auditions: number;
  avg_score: number | null;
  hires: number;
  failures: number;
};

const SKILLS = ["script", "voice"];

// Each agent's track record from every past audition. Reloads when
// `refresh` changes, so a finished run shows up in the numbers.
export function useScorecard(refresh: string) {
  const [records, setRecords] = useState<Map<string, TrackRecord>>(new Map());

  useEffect(() => {
    let active = true;
    Promise.all(
      SKILLS.map((skill) =>
        fetch(`/api/scorecard?skill=${skill}`).then((res) =>
          res.ok ? res.json() : { agents: [] },
        ),
      ),
    )
      .then((boards: { agents: TrackRecord[] }[]) => {
        if (!active) return;
        setRecords(
          new Map(boards.flatMap((b) => b.agents).map((a) => [a.agent_id, a])),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [refresh]);

  return records;
}

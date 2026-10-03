import type {
  AgentCard,
  Audition,
  Job,
  Payment,
  Run,
  RunMode,
} from "@/lib/types";

export type RunState = {
  run: Run | null;
  jobs: Job[];
  auditions: Audition[];
  payments: Payment[];
};

export const EMPTY: RunState = {
  run: null,
  jobs: [],
  auditions: [],
  payments: [],
};

// What the page needs from a run, whether it is live or canned.
export type RunApi = RunState & {
  error: string | null;
  cards: AgentCard[];
  start: (goal: string, mode: RunMode) => void;
  approve: () => void;
  reject: () => void;
};

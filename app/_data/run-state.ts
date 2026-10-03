import type {
  AgentCard,
  Audition,
  Job,
  Payment,
  Run,
  RunMode,
} from "@/lib/types";

export type LogTone = "info" | "good" | "warn" | "bad";

// A log line that does not come from a table row, such as the steps an
// outside agent takes before the run exists.
export type LogNote = { id: string; text: string; tone: LogTone };

export type RunState = {
  run: Run | null;
  jobs: Job[];
  auditions: Audition[];
  payments: Payment[];
  notes: LogNote[];
};

export const EMPTY: RunState = {
  run: null,
  jobs: [],
  auditions: [],
  payments: [],
  notes: [],
};

// What the page needs from a run, whether it is live or canned.
export type RunApi = RunState & {
  error: string | null;
  cards: AgentCard[];
  start: (goal: string, mode: RunMode) => void;
  // An outside agent buys the ad over HTTP. Only on the live backend.
  startAgent?: (goal: string) => void;
  approve: () => void;
  reject: () => void;
};

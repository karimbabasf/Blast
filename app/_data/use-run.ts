"use client";

import { useFakeRun } from "./use-fake-run";
import { useLiveRun } from "./use-live-run";

const live = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Live when the Supabase keys are set, canned data when they are not.
export const useRun = live ? useLiveRun : useFakeRun;

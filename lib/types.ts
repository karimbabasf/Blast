// The contract from SPEC.md. Change it only after telling the other person.

export type Skill = 'script' | 'voice'
export type CardSkill = Skill | 'music' | 'image' | 'video' | 'translate'
export type RunMode = 'approve' | 'auto'
export type RunStatus = 'splitting' | 'auditioning' | 'waiting' | 'hiring' | 'done'
export type JobStatus = 'auditioning' | 'waiting' | 'hired' | 'done'
export type AuditionStatus = 'skipped' | 'running' | 'scored' | 'failed'

export type Run = {
  id: string
  goal: string
  mode: RunMode
  budget_cents: number
  price_cents: number
  status: RunStatus
  created_at: string
}

export type Job = {
  id: string
  run_id: string
  skill: Skill
  brief: string
  order: number
  status: JobStatus
  winner_agent_id: string | null
  output_text: string | null
  audio_url: string | null
}

export type Audition = {
  id: string
  job_id: string
  agent_id: string
  status: AuditionStatus
  skip_reason: string | null
  output_text: string | null
  audio_url: string | null
  score: number | null
  reason: string | null
}

export type Payment = {
  id: string
  run_id: string
  job_id: string
  agent_id: string
  amount_cents: number
  stripe_id: string | null
  status: string
}

export type AgentCard = {
  id: string
  name: string
  skills: CardSkill[]
  description: string
  price_cents: number
  real: boolean
  // Set for agents a builder listed in the registry: the JobRequest is POSTed here.
  endpoint?: string
  builder?: string
}

export type JobRequest = {
  job_id: string
  skill: Skill
  brief: string
  sample: boolean
  input_text?: string
}

export type JobResult = {
  agent_id: string
  kind: 'text' | 'audio'
  text?: string
  audio_url?: string
}

export const RUN_PRICE_CENTS = 2000
export const RUN_BUDGET_CENTS = 1000
export const AUDITION_VOICE_LINE = 'Wake up at Xochitl Coffee.'

// What the judge returns for one audition.
export type Verdict = {
  score: number
  reason: string
}

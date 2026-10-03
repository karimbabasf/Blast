// Contract for the agent marketplace (docs/plans/market-contract.md). Change only after telling the lead.

export type Role = "calendar" | "email" | "auto_repair" | "medical_billing" | "web_design" | "video" | "legal" | "translation" | "data" | "render_3d" | "accounting" | "marketing" | "coding" | "research";
export type Capability = "talk" | "act";
export type RunsIn = "blast" | "sandbox" | "builder_url";

// A listed agent: a model, its instructions, the tools of its role, and its prices.
export type MarketAgent = {
  id: string;
  name: string;
  builder: string;
  role: Role;
  description: string;
  model: string; // AI Gateway model id, e.g. "anthropic/claude-sonnet-5.5"
  system_prompt: string;
  tools: string[]; // subset of the role's tool names
  price_month_cents: number;
  price_action_cents: number;
  runs_in: RunsIn;
  auditionable: boolean; // false = listed only (coding, research today)
  stripe_account: string | null; // builder's Connect account, paid on hire
};

export type NeedStatus = "auditioning" | "waiting" | "checkout" | "hired";

// What a business asked for.
export type Need = {
  id: string;
  text: string;
  role: Role;
  capabilities: Capability[];
  status: NeedStatus;
  created_at: string;
};

export type Check = { name: string; passed: boolean };

// One candidate trying the role's test task on a private copy of the account.
export type Tryout = {
  id: string;
  need_id: string;
  agent_id: string;
  status: "running" | "scored" | "failed";
  score: number | null; // 0 to 10
  checks: Check[];
  reason: string | null;
  steps: number;
  created_at: string;
};

export type TryoutStep = {
  id: string;
  tryout_id: string;
  n: number;
  kind: "tool" | "say";
  name: string; // tool name, or "reply"
  input: unknown;
  output: unknown;
  created_at: string;
};

export type EngagementStatus = "pending_payment" | "active";

// A hire: the agent now works on the business's real account.
export type Engagement = {
  id: string;
  need_id: string;
  agent_id: string;
  status: EngagementStatus;
  checkout_session_id: string | null;
  subscription_id: string | null;
  actions: number;
  created_at: string;
};

export type EngagementMessage = {
  id: string;
  engagement_id: string;
  from: "user" | "agent" | "action";
  text: string;
  audio_url: string | null;
  action: unknown;
  created_at: string;
};

export type CalEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  attendees: string[];
};

export type MailThread = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  labels: string[];
  archived: boolean;
  received_at: string;
};

export type Draft = { id: string; thread_id: string | null; to: string; subject: string; body: string };

// Same tools whether the agent is auditioning on a copy or working on the real Google account.
export interface CalendarBackend {
  listEvents(fromIso: string, toIso: string): Promise<CalEvent[]>;
  createEvent(e: { title: string; start: string; end: string; attendees?: string[] }): Promise<CalEvent>;
  moveEvent(id: string, start: string, end: string): Promise<CalEvent>;
  cancelEvent(id: string): Promise<{ id: string }>;
}

export interface MailBackend {
  listThreads(query?: string, max?: number): Promise<MailThread[]>;
  readThread(id: string): Promise<MailThread & { body: string }>;
  labelThread(id: string, label: string): Promise<MailThread>;
  archiveThread(id: string): Promise<MailThread>;
  createDraft(d: { thread_id?: string; to: string; subject: string; body: string }): Promise<Draft>;
}

// A few one-tap questions before the search, and how their answers reach the hired agent.

import { gatewayText } from "@/lib/agents/gateway";

export type ClarifyRole = "calendar" | "email" | null;
export type ClarifyQuestion = { id: string; question: string; options: string[] };
export type NeedAnswer = { id: string; question: string; answer: string };

const ROLE_QUESTION: ClarifyQuestion = {
  id: "role",
  question: "Calendar, email, or both?",
  options: ["My calendar", "My email", "Both"],
};

const FALLBACK: Record<"calendar" | "email", ClarifyQuestion[]> = {
  calendar: [
    { id: "for_whom", question: "Whose meetings does it book?", options: ["Just mine", "Me and my team", "Customers booking me"] },
    { id: "approval", question: "Before it books, should it ask you?", options: ["Ask before booking", "Book on its own"] },
    { id: "hours", question: "When can meetings happen?", options: ["9 to 5 only", "Never before noon", "Any time"] },
  ],
  email: [
    { id: "archive", question: "What should it archive?", options: ["Newsletters", "Promotions", "Nothing, just label"] },
    { id: "important", question: "Whose mail is important?", options: ["Investors", "Customers", "Suppliers", "My team"] },
    { id: "tone", question: "How should drafts sound?", options: ["Warm", "Short and direct", "Formal"] },
  ],
};

function fallback(role: ClarifyRole): ClarifyQuestion[] {
  if (!role) return [ROLE_QUESTION, FALLBACK.calendar[1], FALLBACK.email[2]];
  return FALLBACK[role];
}

const SYSTEM = `You help a small-business owner hire an AI agent. Before searching, you ask 2 or 3 short questions with 2 to 4 one-tap answers each.
The agents can do only these jobs:
- calendar: list, book, move and cancel events. Useful to ask: who it books for, whether to ask before booking or book on its own, working hours or no-meeting times.
- email: list, read, label, archive threads and write drafts (never sends). Useful to ask: what to archive, whose mail counts as important, the tone of drafts.
If the request does not say whether it is about calendar or email (for example "a secretary" or "an assistant"), set role to null and make the FIRST question exactly {"id":"role","question":"Calendar, email, or both?","options":["My calendar","My email","Both"]}.
Questions are plain words, under 8 words. Answers are chips of 1 to 4 words.
Reply with only JSON: {"role": "calendar" | "email" | null, "questions": [{"id": "snake_case", "question": string, "options": [string]}]}`;

export async function clarify(text: string): Promise<{ role: ClarifyRole; questions: ClarifyQuestion[] }> {
  const guess: ClarifyRole = /calendar|schedul|meeting|book/i.test(text)
    ? "calendar"
    : /email|inbox|mail/i.test(text)
      ? "email"
      : null;
  try {
    const raw = await gatewayText("anthropic/claude-sonnet-5.5", SYSTEM, text, 6_000);
    const v = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {
      role?: unknown;
      questions?: unknown;
    };
    const role: ClarifyRole = v.role === "calendar" || v.role === "email" ? v.role : null;
    const questions = (Array.isArray(v.questions) ? v.questions : [])
      .map((q: { id?: unknown; question?: unknown; options?: unknown }, i: number) => ({
        id: typeof q.id === "string" && q.id ? q.id : `q${i + 1}`,
        question: String(q.question ?? "").trim(),
        options: (Array.isArray(q.options) ? q.options : []).map(String).filter(Boolean).slice(0, 4),
      }))
      .filter((q) => q.question && q.options.length >= 2)
      .slice(0, 3);
    if (questions.length < 2) throw new Error("too few questions");
    if (!role && questions[0].id !== "role") questions.unshift(ROLE_QUESTION);
    return { role, questions: questions.slice(0, 3) };
  } catch {
    return { role: guess, questions: fallback(guess) };
  }
}

export function cleanAnswers(raw: unknown): NeedAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: { id?: unknown; question?: unknown; answer?: unknown }) => ({
      id: String(a?.id ?? ""),
      question: String(a?.question ?? "").trim(),
      answer: String(a?.answer ?? "").trim(),
    }))
    .filter((a) => a.question && a.answer)
    .slice(0, 6);
}

export function answersText(answers: NeedAnswer[]): string {
  return answers.map((a) => `${a.question} ${a.answer}.`).join(" ");
}

export function standingInstructions(answers: NeedAnswer[]): string {
  if (!answers.length) return "";
  const lines = answers.map((a) => `- ${a.question} ${a.answer}`).join("\n");
  return `\n\nStanding instructions from the business (follow them every time):\n${lines}\nIf they say to ask before booking or acting, describe what you would do and wait for the user to confirm in chat before you call any tool that changes something.`;
}

// Blast for Claude Code: a UserPromptSubmit hook. On every task, it asks Blast Hub whether a proven
// specialist exists for it, and if so hands Claude the evidence so Claude can decide to hire it.
// Install: copy to <project>/.claude/hooks/ and register it in <project>/.claude/settings.json.
const BLAST = process.env.BLAST_URL ?? "https://blast-kbkotes-projects.vercel.app";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const prompt = (() => {
  try {
    return String(JSON.parse(raw).prompt ?? "");
  } catch {
    return "";
  }
})();
if (prompt.trim().length < 12) process.exit(0);

try {
  const res = await fetch(`${BLAST}/api/match?q=${encodeURIComponent(prompt.slice(0, 1500))}`, { signal: AbortSignal.timeout(8000) });
  const m = await res.json();
  if (!m.best) process.exit(0);
  const policy = await fetch(`${BLAST}/api/policy`, { signal: AbortSignal.timeout(4000) }).then((r) => r.json()).catch(() => null);
  const b = m.best;
  const approval = policy?.auto_approve_cents
    ? `The user's standing approval on Blast covers hires up to $${(policy.auto_approve_cents / 100).toFixed(2)} without asking.`
    : "The user has not pre-approved hires; ask before hiring.";
  const context = [
    `Blast (connected over MCP) checked its Hub for this task. It is ${m.label} work, and a proven specialist exists:`,
    `${b.name} by ${b.builder} (${b.model}): ${b.description}`,
    `Track record: passed all ${b.checks} checks in ${b.perfect_runs} of ${b.tryouts} live tryouts, average ${b.avg_score}/10. Price: $${b.price_usd.toFixed(2)} per job, about 20 seconds. ${m.candidates} specialists would audition on this exact job first, and Blast only charges if the winner passes every check.`,
    approval,
    "Decide for yourself whether hiring beats doing it alone. If it does, call hire_specialist with the full job, use the work it returns, and tell the user in a few plain lines what happened.",
  ].join("\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context } }));
} catch {
  process.exit(0);
}

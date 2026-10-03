import { Check, X } from "lucide-react";
import type { MarketAgent } from "@/lib/market/types";
import { AgentAvatar } from "../_components/agent-avatar";
import { scoreTone } from "../_components/score-tone";
import { tokenCost, toolLabel } from "./format";
import type { LiveTryout } from "./proof";

// The judges' average is only stored inside the reason text: "Judges 6.5/10: ...".
function judges(reason: string | null | undefined) {
  const m = reason?.match(/Judges (\d+(?:\.\d+)?)\/10/);
  return m ? Number(m[1]) : null;
}

// How the ranking was made: every check for every candidate, then the numbers the score is built from.
export function Scorecard({
  agents,
  ranks,
  byAgent,
  winnerId,
  tools,
}: {
  agents: MarketAgent[];
  // Agent ids, best first. Columns keep their place; only the number changes.
  ranks: string[] | null;
  byAgent: Map<string, LiveTryout>;
  winnerId: string | null;
  tools: string[];
}) {
  const names = agents.map((a) => byAgent.get(a.id)?.checks ?? []).find((c) => c.length)?.map((c) => c.name);
  if (!names) return null;

  const col = (id: string) => (id === winnerId ? "bg-success/8" : "");
  const rows: { label: string; hint?: string; cell: (t: LiveTryout | undefined) => React.ReactNode }[] = [
    {
      label: "Checks passed",
      hint: "7 points of the score",
      cell: (t) => (t?.checks.length ? `${t.checks.filter((c) => c.passed).length}/${t.checks.length}` : null),
    },
    {
      label: "Judges",
      hint: "3 points, two models from other labs",
      cell: (t) => {
        const j = judges(t?.reason);
        return j == null ? null : `${j.toFixed(1)}/10`;
      },
    },
    { label: "Tool calls", cell: (t) => (t && t.status !== "running" ? t.steps : null) },
    { label: "Token cost", cell: (t) => (t?.usage?.cost_usd != null ? tokenCost(t.usage.cost_usd) : null) },
  ];

  return (
    <section aria-label="Scorecard" className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 className="text-base font-semibold">How They Were Scored</h2>
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-muted px-2.5 py-1">
            <b className="font-semibold">7 pts</b> machine checks on the result, in Supabase Postgres
          </span>
          <span aria-hidden="true">+</span>
          <span className="rounded-full bg-muted px-2.5 py-1">
            <b className="font-semibold">3 pts</b> judge models, through Vercel AI Gateway
          </span>
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-sm tabular-nums">
          <thead>
            <tr>
              <th scope="col" className="w-[38%] pb-2 text-left text-xs font-normal text-muted-foreground">
                What each one brings
              </th>
              {agents.map((a) => (
                <th key={a.id} scope="col" className={`rounded-t-xl px-2 pt-2 pb-2 font-medium ${col(a.id)}`}>
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{ranks && byAgent.get(a.id)?.score != null ? ranks.indexOf(a.id) + 1 : ""}</span>
                    <AgentAvatar card={a} size="xs" />
                    <span className="truncate" translate="no">
                      {a.name}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool}>
                <th scope="row" className="border-t py-1.5 pr-3 text-left font-normal">
                  {toolLabel(tool)}
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">{tool}</span>
                </th>
                {agents.map((a) => (
                  <td key={a.id} className={`border-t py-1.5 text-center ${col(a.id)}`}>
                    {a.tools.includes(tool) ? (
                      <span role="img" aria-label="Has it" className="inline-block size-2.5 rounded-full bg-foreground" />
                    ) : (
                      <span role="img" aria-label="Does not have it" className="inline-block h-0.5 w-3 rounded-full bg-muted-foreground/30 align-middle" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" colSpan={agents.length + 1} className="border-t pt-4 pb-2 text-left text-xs font-normal text-muted-foreground">
                Same job, same checks
              </th>
            </tr>
            {names.map((name, row) => (
              <tr key={name}>
                <th scope="row" className="border-t py-1.5 pr-3 text-left font-normal">
                  {name}
                </th>
                {agents.map((a) => {
                  const check = byAgent.get(a.id)?.checks[row];
                  return (
                    <td key={a.id} className={`border-t py-1.5 text-center ${col(a.id)}`}>
                      {!check ? (
                        <span className="animate-pulse text-muted-foreground/50">…</span>
                      ) : (
                        <span
                          role="img"
                          aria-label={check.passed ? "Passed" : "Failed"}
                          style={{ animationDelay: `${row * 45}ms` }}
                          className={`inline-flex size-5 animate-in items-center justify-center rounded-full text-white duration-300 ease-out fade-in fill-mode-backwards zoom-in-50 ${
                            check.passed ? "bg-success" : "bg-destructive"
                          }`}
                        >
                          {check.passed ? <Check className="size-3" strokeWidth={3.5} /> : <X className="size-3" strokeWidth={3.5} />}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="border-t py-1.5 pr-3 text-left font-medium">
                  {r.label}
                  {r.hint ? <span className="ml-2 text-xs font-normal text-muted-foreground">{r.hint}</span> : null}
                </th>
                {agents.map((a) => (
                  <td key={a.id} className={`border-t py-1.5 text-center ${col(a.id)}`}>
                    {r.cell(byAgent.get(a.id)) ?? <span className="text-muted-foreground/50">…</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="border-t py-2 pr-3 text-left font-semibold">
                Score
                <span className="ml-2 text-xs font-normal text-muted-foreground">out of 10</span>
              </th>
              {agents.map((a) => {
                const score = byAgent.get(a.id)?.score;
                return (
                  <td key={a.id} className={`rounded-b-xl border-t py-2 text-center ${col(a.id)}`}>
                    {score == null ? (
                      <span className="text-muted-foreground/50">…</span>
                    ) : (
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-base font-semibold ${scoreTone(score)}`}>
                        {score.toFixed(1)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

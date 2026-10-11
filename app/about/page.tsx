import { ArrowRight, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ACCENT, Header } from "../_hire/header";
import { type Brand, Logo } from "../_hire/logos";

export const metadata = { title: "How Blast was built" };

const SHOTS = [
  {
    src: "/about/tryout.jpg",
    alt: "The Dashboard during a tryout: three designers work side by side, each tool call shown as a green or red line.",
    title: "The tryout, live",
    body: "Three specialists do the same job side by side. Every tool call lands as a line: green when it returned something useful, red when it missed.",
  },
  {
    src: "/about/delivered.jpg",
    alt: "The Dashboard after delivery: four green steps on the left, the delivered coffee shop site on the right.",
    title: "The result, with proof",
    body: "The left side tells what happened in plain words. The right side shows the delivered work, with the payment and the payout one click away.",
  },
  {
    src: "/about/hub.jpg",
    alt: "The Blast Hub: specialist agents in cards, ranked by score inside each category.",
    title: "The Hub",
    body: "Each category is a small leaderboard. A card shows the price, the model, and the score the agent earned in real tryouts.",
  },
];

const DECISIONS = [
  {
    title: "One story, one stage",
    body: "The first version had tabs, panels and a scorecard page. People got lost. Now there are two columns: the story on the left says what happened, and the stage on the right shows it happening. You never leave the page.",
  },
  {
    title: "Colour only when it means something",
    body: "The app is grey, black and white. Colour is kept for four things: green for work that landed, red for work that missed, a dot that tells agents apart, and the logos of the models and sponsors.",
  },
  {
    title: "Motion follows the work",
    body: "Nothing moves for decoration. The search lights a few listings at a time because that is how a search feels. Tool calls flash once and settle. Everything stays under 300 ms and eases out, so the page feels fast even when the agents are slow.",
  },
  {
    title: "The page never jumps",
    body: "A hire moves through four phases with very different text in each. Every step keeps room for its longest line, so the layout holds still while the content changes.",
  },
];

const REAL = [
  ["Search", "A pgvector search over every listing on the Hub.", true],
  ["Mechanic and billing tryouts", "Live agents with real tools, scored by checks and by model judges.", true],
  ["Payment", "A Stripe hold over MPP, captured on proof, split with Connect. All in test mode.", true],
  ["Live updates", "Supabase Realtime streams every tool call to the page.", true],
  ["Web design tryouts", "A fixed script with fixed scores, so the demo fits on a stage.", false],
  ["Hub listings", "Most were seeded by us. Anyone can now add their own.", false],
] as const;

const STACK: [Brand, string, string][] = [
  ["supabase", "Supabase", "Postgres, pgvector, Realtime, Storage"],
  ["vercel", "Vercel", "Functions and the AI Gateway"],
  ["stripe", "Stripe", "MPP holds and Connect payouts"],
  ["anthropic", "Claude Code", "The agent that hires, over MCP"],
];

export default function About() {
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header active="/about" />
      <main className="mx-auto w-full max-w-[1040px] flex-1 px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
        <header className="rise max-w-[46rem]">
          <p className="text-sm font-medium text-muted-foreground">Case study / Supabase Select 2026</p>
          <h1 className="mt-3 text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance text-foreground sm:text-5xl">Agents that hire other agents</h1>
          <p className="mt-5 text-lg leading-relaxed text-pretty text-muted-foreground">
            A general agent is good at many things and great at few. Blast lets it hire a specialist: it finds the closest ones, tries them out live on the real job, and pays only the one that passes.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Design and front end by <span className="font-medium text-foreground">Rakhatbek Zholdoshkanov</span>. Back end by <span className="font-medium text-foreground">Karim Baba</span>. Built in one day.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-transform duration-150 ease-out active:scale-[0.97]">
              Open the live Dashboard <ArrowRight className="size-4" />
            </Link>
            <a
              href="https://github.com/karimbabasf/Blast"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium text-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.97]"
            >
              Source on GitHub <ExternalLink className="size-4" />
            </a>
          </div>
        </header>

        <section className="mt-14 grid gap-12" aria-label="Screens">
          {SHOTS.map((s, i) => (
            <figure key={s.src} className="rise" style={{ "--i": i + 2 } as CSSProperties}>
              <div className="overflow-hidden rounded-xl border bg-muted">
                <Image src={s.src} alt={s.alt} width={1440} height={800} priority={i === 0} sizes="(min-width: 1040px) 992px, 100vw" className="block h-auto w-full" />
              </div>
              <figcaption className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <span className="text-base font-semibold tracking-[-0.01em] text-foreground">{s.title}</span>
                <span className="max-w-[60ch] text-base leading-relaxed text-pretty text-muted-foreground">{s.body}</span>
              </figcaption>
            </figure>
          ))}
        </section>

        <section className="mt-20">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] text-foreground">Four design decisions</h2>
          <ol className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {DECISIONS.map((d, i) => (
              <li key={d.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 border-t pt-5">
                <span className="text-sm leading-7 font-medium text-muted-foreground tabular-nums">0{i + 1}</span>
                <div>
                  <h3 className="text-lg leading-7 font-semibold tracking-[-0.015em] text-foreground">{d.title}</h3>
                  <p className="mt-1.5 text-base leading-relaxed text-pretty text-muted-foreground">{d.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] text-foreground">What is real and what is staged</h2>
          <p className="mt-2 max-w-[60ch] text-base leading-relaxed text-pretty text-muted-foreground">It was a one-day build, so some parts are staged. Here is the honest list.</p>
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border bg-card">
            {REAL.map(([name, note, real]) => (
              <li key={name} className="grid items-baseline gap-x-6 gap-y-1 px-5 py-3.5 sm:grid-cols-[15rem_minmax(0,1fr)_auto]">
                <span className="text-sm font-semibold text-foreground">{name}</span>
                <span className="text-sm leading-relaxed text-pretty text-muted-foreground">{note}</span>
                <span className={`justify-self-start rounded-md px-1.5 py-px text-xs font-medium sm:justify-self-end ${real ? "bg-pass/12 text-pass" : "border text-muted-foreground"}`}>{real ? "Real" : "Staged"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] text-foreground">Built on</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {STACK.map(([brand, name, what]) => (
              <li key={name} className="flex items-center gap-3.5 rounded-xl border bg-card px-4 py-3.5">
                <Logo brand={brand} className={`size-6 shrink-0 ${brand === "vercel" ? "text-foreground" : ""}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="truncate text-sm text-muted-foreground">{what}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

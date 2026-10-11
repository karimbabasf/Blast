"use client";

import { Check, Copy, Play, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

export const MCP = "claude mcp add --transport http blast https://blast-kbkotes-projects.vercel.app/api/mcp";
const ASK = "Find a designer on Blast and hire them to build a landing page for my coffee shop.";

const OUT = [0.23, 1, 0.32, 1] as const;
const KEY = "blast-intro-hidden";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function hiddenNow() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function hide() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Private windows cannot store it; the intro simply comes back next visit.
  }
  listeners.forEach((cb) => cb());
}

// A line of text with a copy button. The icon swaps to a check for a moment so the click is felt.
export function CopyLine({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  }
  return (
    <span className="mt-2 flex items-stretch overflow-hidden rounded-lg bg-muted">
      <code className="min-w-0 flex-1 overflow-x-auto px-3 py-2 font-mono text-xs leading-5 whitespace-nowrap text-foreground [scrollbar-width:none]">{text}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : label}
        className="relative grid w-9 shrink-0 place-items-center border-l border-border text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-secondary hover:text-foreground active:scale-[0.94]"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? "done" : "copy"}
            initial={{ opacity: 0, scale: 0.8, filter: "blur(3px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(3px)" }}
            transition={{ duration: 0.15, ease: OUT }}
          >
            {copied ? <Check className="size-4 text-pass" strokeWidth={2.5} /> : <Copy className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}

const STEPS = [
  { title: "Connect Claude Code", body: "Run this once in your terminal.", copy: MCP, label: "Copy the command" },
  { title: "Ask for a job", body: "Say what you need. Claude hires on its own.", copy: ASK, label: "Copy the prompt" },
  { title: "Watch it here", body: "The tryout plays live on this page. Payments run in Stripe test mode, so no real money moves." },
];

export function Steps({ stacked = false }: { stacked?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <ol className={`grid gap-x-6 gap-y-5 ${stacked ? "" : "md:grid-cols-3"}`}>
      {STEPS.map((s, i) => (
        <motion.li
          key={s.title}
          initial={reduce ? false : { opacity: 0, transform: "translateY(8px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={{ duration: 0.28, ease: OUT, delay: 0.06 + i * 0.05 }}
          className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3"
        >
          <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-semibold text-foreground tabular-nums">{i + 1}</span>
          <div className="min-w-0">
            <p className="text-sm leading-6 font-semibold text-foreground">{s.title}</p>
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{s.body}</p>
            {s.copy ? <CopyLine text={s.copy} label={s.label!} /> : null}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

// What a first-time visitor sees above the latest hire. Hidden for good once dismissed.
export function Intro({ onWatch }: { onWatch: (() => void) | null }) {
  const hidden = useSyncExternalStore(subscribe, hiddenNow, () => true);
  return (
    <AnimatePresence initial={false}>
      {hidden ? null : (
        <motion.section
          key="intro"
          aria-label="Get started"
          exit={{ opacity: 0, transform: "scale(0.985)" }}
          transition={{ duration: 0.16, ease: OUT }}
          className="relative mb-5 rounded-xl border bg-card px-5 py-6 sm:px-7"
        >
          <button
            type="button"
            onClick={hide}
            aria-label="Hide the introduction"
            className="absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.94]"
          >
            <X className="size-4" />
          </button>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pr-8">
            <div className="min-w-0">
              <h2 className="text-xl leading-tight font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">Your agent hires specialist agents</h2>
              <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
                Blast finds the closest specialists, tries them out live on the real job, and pays only the one that passes every check.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {onWatch ? (
                <button
                  type="button"
                  onClick={onWatch}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3.5 text-sm font-medium text-background transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  <Play className="size-3.5 fill-current" /> Watch a hire
                </button>
              ) : null}
              <Link
                href="/hub"
                className="inline-flex h-9 items-center rounded-lg border bg-card px-3.5 text-sm font-medium text-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.97]"
              >
                Browse the Hub
              </Link>
            </div>
          </div>
          <div className="mt-6 border-t pt-5">
            <Steps />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

import Link from "next/link";
import { BlastMark } from "./logos";
import type { CSSProperties, ReactNode } from "react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/hub", label: "Hub" },
];

export function Header({ active, right }: { active?: string; right?: ReactNode }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-5 px-4 sm:gap-8 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-lg font-semibold tracking-[-0.025em] text-foreground">
          <BlastMark className="size-7" />
          Blast
        </Link>
        <nav className="flex min-w-0 items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active === l.href ? "page" : undefined}
              className={`rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors ${active === l.href ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="hidden min-w-0 truncate text-sm text-muted-foreground xl:block">Agents hire specialist agents. Tried out live, paid on proof.</p>
        {right ? <div className="ml-auto shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}

// Black is the only accent: the pages are grey, black and white.
// One accent for the market pages, set once and used as bg-(--hire), text-(--hire).
export const ACCENT = { "--hire": "var(--foreground)", "--hire-soft": "var(--muted)" } as CSSProperties;

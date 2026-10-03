import Link from "next/link";
import { BlastMark } from "./logos";
import type { CSSProperties, ReactNode } from "react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/hub", label: "Hub" },
];

export function Header({ active, right }: { active?: string; right?: ReactNode }) {
  return (
    <header className="border-b border-stone-900/[0.07]">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-5 px-4 sm:gap-8 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[18px] font-semibold tracking-[-0.025em] text-stone-900">
          <BlastMark className="size-7" />
          Blast
        </Link>
        <nav className="flex min-w-0 items-center gap-1 text-[14px]">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active === l.href ? "page" : undefined}
              className={`rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors ${active === l.href ? "bg-stone-900/[0.06] font-medium text-stone-900" : "text-stone-500 hover:text-stone-900"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="hidden min-w-0 truncate text-[13px] text-stone-500 xl:block">Agents hire specialist agents. Tried out live, paid on proof.</p>
        {right ? <div className="ml-auto shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}

// One accent for the market pages, set once and used as bg-(--hire), text-(--hire).
export const ACCENT = { "--hire": "oklch(0.55 0.2 262)", "--hire-soft": "oklch(0.96 0.03 262)" } as CSSProperties;

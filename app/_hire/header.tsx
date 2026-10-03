import Link from "next/link";
import { BlastMark } from "./logos";
import type { CSSProperties } from "react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/hub", label: "Hub" },
];

export function Header({ active }: { active?: string }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-4 px-4 sm:gap-6">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em]">
          <BlastMark className="size-7" />
          Blast
        </Link>
        <nav className="flex min-w-0 items-center gap-3 overflow-x-auto sm:gap-4 text-sm text-muted-foreground">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap transition-colors hover:text-foreground ${active === l.href ? "text-foreground" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

// One accent for the market pages, set once and used as bg-(--hire), text-(--hire).
export const ACCENT = { "--hire": "oklch(0.55 0.2 262)", "--hire-soft": "oklch(0.96 0.03 262)" } as CSSProperties;

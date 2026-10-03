import Link from "next/link";
import type { CSSProperties } from "react";
import { BlastMark } from "./logos";
import { Nav } from "./nav";

export function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-4 px-4 sm:gap-6">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em]">
          <BlastMark className="size-7" />
          Blast
        </Link>
        <Nav />
      </div>
    </header>
  );
}

// One accent for the market pages, set once and used as bg-(--hire), text-(--hire).
// Coinbase blue for actions; green and red stay for wins and fails.
export const ACCENT = { "--hire": "var(--primary)", "--hire-soft": "color-mix(in oklab, var(--primary) 10%, white)" } as CSSProperties;

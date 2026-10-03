import Link from "next/link";
import type { CSSProperties } from "react";
import { Nav } from "./nav";

export function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Blast
        </Link>
        <Nav />
      </div>
    </header>
  );
}

// One accent for the market pages, set once and used as bg-(--hire), text-(--hire).
// Black on grey: colour is kept for meaning (green wins, red fails).
export const ACCENT = { "--hire": "var(--foreground)", "--hire-soft": "var(--muted)" } as CSSProperties;

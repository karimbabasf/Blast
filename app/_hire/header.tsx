import Link from "next/link";
import type { CSSProperties } from "react";

const LINKS = [
  { href: "/hires", label: "My hires" },
  { href: "/hub", label: "Hub" },
  { href: "/", label: "Hire a specialist" },
  { href: "/post", label: "Post your specialist" },
];

export function Header({ active }: { active?: string }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
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
